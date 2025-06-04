import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { createBuckets } from './buckets.js';
import { Ball } from './balls.js';
import { createPegGrid } from './pegs.js';
import { PEG_SPACING_X, PEG_SPACING_Y, PEG_RADIUS } from './constants.js';

export class GaltonBoard extends EventTarget {
  constructor(options = {}) {
    super();

    // Extract options with defaults
    const {
      container,
      width = 800,
      height = 600,
      pegRows = 12,
      ballRadius = 0.2,
      autoSpawn = true,
      gravity = 9.81,
      animationSpeed = 1.0
    } = options;

    if (!container) {
      throw new Error('Container element is required');
    }

    // Store configuration
    this.container = container;
    this.width = width;
    this.height = height;
    this.pegRows = pegRows;
    this.ballRadius = ballRadius;
    this.autoSpawn = autoSpawn;
    this.gravity = gravity;
    this.animationSpeed = animationSpeed;
    this.boardHeight = this.pegRows * PEG_SPACING_Y;

    // Initialize instance variables
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.world = null;
    this.balls = [];
    this.pegs = null;
    this.buckets = null;
    this.clock = null;
    this.animationId = null;
    this.isInitialized = false;
    this.ballsSpawned = 0;

    this.initialize();
  }

  initialize() {
    if (this.isInitialized) return;

    console.log(`Initializing simulation. Pegs: ${this.pegRows}`);

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, -this.boardHeight / 2, 25);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, -this.boardHeight / 2, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;

    // Physics
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -this.gravity, 0),
    });

    this.world.allowSleep = true;

    const material = new CANNON.Material();
    this.world.defaultContactMaterial = new CANNON.ContactMaterial(material, material, {
      friction: 0.1,
      restitution: 0.4,
    });

    // Create pegs
    this.pegs = createPegGrid(this.scene, this.world, this.pegRows, PEG_SPACING_X, PEG_SPACING_Y, PEG_RADIUS);

    // Create buckets
    this.buckets = createBuckets(this.scene, this.world, this.pegRows, PEG_SPACING_X, PEG_SPACING_Y);
    this.buckets.forEach(bucket => {
      bucket.addEventListener('ball-entered-bucket', this.onBallEnteredBucket.bind(this));
    });

    // Setup lighting
    this.setupLighting();

    // Start with first ball if autoSpawn is enabled
    this.ballsSpawned = 0;
    if (this.autoSpawn) {
      this.spawnBall();
    }

    this.clock = new THREE.Clock();
    this.isInitialized = true;
    this.startAnimation();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const light = new THREE.DirectionalLight(0xffffff, 5);
    light.position.set(5, 10, 7.5);
    light.castShadow = true;
    this.scene.add(light);

    const light2 = new THREE.DirectionalLight(0xffffff, 0.4);
    light2.position.set(-5, 5, 5);
    this.scene.add(light2);
  }

  spawnBall() {
    if (!this.scene || !this.world) return null;
    
    const ball = Ball.createRandomBall(this.scene, this.world, this.ballRadius);
    this.ballsSpawned++;
    
    // Always set up collision handler, but make it conditional on autoSpawn
    ball.setupPegCollisionHandler(() => {
      // Check autoSpawn at the time of collision, not when the ball was created
      if (this.autoSpawn) {
        this.spawnBall();
      }
    });
    
    this.balls.push(ball);
    
    // Dispatch custom event when ball is spawned
    this.dispatchEvent(new CustomEvent('ball-spawned', {
      detail: { ball, totalBalls: this.balls.length }
    }));
    
    return ball;
  }

  startAnimation() {
    if (this.animationId) return;
    
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      if (!this.world || !this.scene || !this.camera || !this.renderer) return;

      const delta = this.clock.getDelta();
      this.world.step(1 / 60, delta * this.animationSpeed, 3);

      // Update all balls
      this.balls.forEach(ball => {
        ball.update();
        
        if (ball.inBucket != null && ball.body.sleepState === CANNON.Body.AWAKE) {
          const displacement = ball.getDisplacementInLastSecond();
          if (displacement < 0.05) {
            ball.body.sleep();
          }
        }
      });

      // Clean up balls that have fallen too low or become static
      for (let i = this.balls.length - 1; i >= 0; i--) {
        if (this.balls[i].getPosition().y < -this.boardHeight * 2){
          this.balls[i].destroy();
          this.balls.splice(i, 1);
        }
        if (this.balls[i].body.type === CANNON.Body.STATIC) {
          this.balls.splice(i, 1);
        }
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resize(width, height) {
    if (!this.camera || !this.renderer) return;
    
    this.width = width;
    this.height = height;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  cleanup() {
    this.stopAnimation();
    
    // Clean up balls
    this.balls.forEach(ball => ball.destroy());
    this.balls = [];

    // Clean up Three.js objects
    if (this.renderer) {
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }

    if (this.controls) {
      this.controls.dispose();
    }

    // Clean up physics world
    if (this.world) {
      this.world.bodies.forEach(body => {
        this.world.removeBody(body);
      });
    }
    
    this.isInitialized = false;
  }

  // Public methods for external control
  addBall() {
    return this.spawnBall();
  }

  reset() {
    const toDestroy = [];
    this.world.bodies.forEach(body => {
      if (body.userData?.ball) {
        toDestroy.push(body.userData.ball);
      }
      if (body.userData?.reset) {
        body.userData.reset();
      }
    });
    toDestroy.forEach(ball => ball.destroy());
    this.balls = [];
    this.ballsSpawned = 0;
    
    if (this.autoSpawn) {
      this.spawnBall();
    }

    this.dispatchEvent(new CustomEvent('reset'));
  }

  getBallCount() {
    return this.ballsSpawned;
  }

  getBucketCounts() {
    if (!this.buckets) return [];
    return this.buckets.map(bucket => bucket.getCount());
  }

  // Configuration setters
  setAutoSpawn(autoSpawn) {
    this.autoSpawn = autoSpawn;
    console.log(`AutoSpawn updated to: ${this.autoSpawn}`);
    
    if (this.autoSpawn) {
      this.spawnBall();
    }
  }

  setBallRadius(ballRadius) {
    this.ballRadius = ballRadius;
    console.log(`Ball radius updated to: ${this.ballRadius}`);
  }

  setGravity(gravity) {
    this.gravity = gravity;
    if (this.world) {
      this.world.gravity.set(0, -this.gravity, 0);
    }
    console.log(`Gravity updated to: ${this.gravity}`);
  }

  setAnimationSpeed(animationSpeed) {
    this.animationSpeed = animationSpeed;
    console.log(`Animation speed updated to: ${this.animationSpeed}`);
  }

  onBallEnteredBucket(event) {
    this.dispatchEvent(new CustomEvent('ball-entered-bucket', {
      detail: { ball: event.detail.ball, bucket: event.detail.bucket },
      originalEvent: event
    }));
  }
} 