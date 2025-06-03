import { LitElement, html, css } from 'lit';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { createBuckets } from './buckets.js';
import { Ball } from './balls.js';
import { createPegGrid } from './pegs.js';
import { PEG_SPACING_X, PEG_SPACING_Y, PEG_RADIUS, GRAVITY, ANIMATION_SPEED } from './constants.js';

export class GaltonBoard extends LitElement {
  static properties = {
    width: { type: Number },
    height: { type: Number },
    pegRows: { 
      type: Number,
      attribute: 'peg-rows',
      converter: {
        fromAttribute: (value) => {
          console.log(`Converting pegRows from attribute: "${value}" (type: ${typeof value})`);
          const numValue = Number(value);
          return isNaN(numValue) ? 12 : numValue;
        }
      }
    },
    ballRadius: { type: Number },
    autoSpawn: { 
      type: Boolean,
      attribute: 'auto-spawn',
      converter: {
        fromAttribute: (value) => {
          console.log(`Converting autoSpawn from attribute: "${value}" (type: ${typeof value})`);
          if (value === null) return true; // Default when attribute not present
          if (value === 'false' || value === false) return false;
          return Boolean(value);
        }
      }
    },
    gravity: { type: Number },
    animationSpeed: { type: Number }
  };

  // Ensure pegRows is always a number
  set pegRows(value) {
    const numValue = Number(value);
    const newValue = isNaN(numValue) ? 12 : numValue;
    if (this._pegRows !== newValue) {
      this._pegRows = newValue;
      this.boardHeight = this._pegRows * PEG_SPACING_Y;
      this.requestUpdate('pegRows', undefined);
    }
  }

  get pegRows() {
    return this._pegRows;
  }

  // Ensure autoSpawn is always a boolean
  set autoSpawn(value) {
    // Convert string "false" to boolean false, everything else follows normal JS truthy/falsy rules
    const boolValue = value === "false" ? false : Boolean(value);
    console.log(`Setting autoSpawn: "${value}" (type: ${typeof value}) -> ${boolValue}`);
    if (this._autoSpawn !== boolValue) {
      this._autoSpawn = boolValue;
      this.requestUpdate('autoSpawn', undefined);
    }
  }

  get autoSpawn() {
    console.log(`Getting autoSpawn: ${this._autoSpawn}`);
    return this._autoSpawn;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
    
    #canvas-container {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  constructor() {
    super();

    // Set default property values
    this.width = 800;
    this.height = 600;
    this._pegRows = 12; // Use private property for internal storage
    this.ballRadius = 0.2;
    this._autoSpawn = true; // Use private property for internal storage
    this.gravity = GRAVITY;
    this.animationSpeed = ANIMATION_SPEED;
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
  }

  firstUpdated() {
    console.log(`firstUpdated called. autoSpawn: ${this.autoSpawn}`);
    this.initializeSimulation();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanup();
  }

  initializeSimulation() {
    if (this.isInitialized) return;

    console.log(`Initializing simulation. Pegs: ${this.pegRows}`);

    const container = this.shadowRoot.querySelector('#canvas-container');
    if (!container) return;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, -this.boardHeight / 2, 25);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(this.renderer.domElement);

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
    this.pegs = createPegGrid(this.scene, this.world, Number(this.pegRows), PEG_SPACING_X, PEG_SPACING_Y, PEG_RADIUS);

    // Create buckets
    this.buckets = createBuckets(this.scene, this.world, Number(this.pegRows), PEG_SPACING_X, PEG_SPACING_Y);
    console.log(`Created ${this.pegs.length} pegs and ${this.buckets.length} buckets`);


    // Setup lighting
    this.setupLighting();

    // Start with first ball if autoSpawn is enabled
    console.log(`AutoSpawn during init: ${this.autoSpawn}`);
    if (this.autoSpawn) {
      this.spawnBall();
    }

    this.clock = new THREE.Clock();
    this.isInitialized = true;
    this.startAnimation();

    // Handle window resize
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    console.log(`Animation speed: ${this.animationSpeed}`);
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
    
    // Always set up collision handler, but make it conditional on autoSpawn
    ball.setupPegCollisionHandler(() => {
      // Check autoSpawn at the time of collision, not when the ball was created
      if (this.autoSpawn) {
        this.spawnBall();
      }
    });
    ball.hasCollisionHandler = true;
    
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

  handleResize() {
    if (!this.camera || !this.renderer) return;
    
    const container = this.shadowRoot.querySelector('#canvas-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

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

    window.removeEventListener('resize', this.handleResize);
    
    this.isInitialized = false;
  }

  // Public methods for external control
  addBall() {
    return this.spawnBall();
  }

  reset() {
    this.balls.forEach(ball => ball.destroy());
    this.balls = [];
    
    if (this.autoSpawn) {
      this.spawnBall();
    }

    this.dispatchEvent(new CustomEvent('reset'));
  }

  getBallCount() {
    return this.balls.length;
  }

  getBucketCounts() {
    if (!this.buckets) return [];
    
    return this.buckets.map(bucket => bucket.getCount());
  }

  render() {
    return html`
      <div id="canvas-container"></div>
    `;
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    
    // If critical properties changed, reinitialize
    if (this.isInitialized && (
      changedProperties.has('pegRows') ||
      changedProperties.has('gravity') ||
      changedProperties.has('animationSpeed')
    )) {
      console.log('Updating simulation. Pegs: ', this.pegRows);
      this.cleanup();
      this.initializeSimulation();
    }

    // Update gravity if it changed
    if (this.world && changedProperties.has('gravity')) {
      this.world.gravity.set(0, -this.gravity, 0);
    }

    // Handle autoSpawn changes
    if (this.isInitialized && changedProperties.has('autoSpawn')) {
      console.log(`AutoSpawn changed to: ${this.autoSpawn}`);
      
      if (this.autoSpawn && this.balls.length === 0) {
        // If autoSpawn is now enabled and no balls exist, spawn the first ball
        this.spawnBall();
      }
      // Note: All balls have conditional collision handlers that check autoSpawn at collision time
      // so existing balls will automatically respect the new autoSpawn setting
    }
  }
}

customElements.define('galton-board', GaltonBoard); 