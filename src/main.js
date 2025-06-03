import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { createBuckets } from './buckets.js';
import { Ball } from './balls.js';
import { createPegGrid } from './pegs.js';
import { PEG_SPACING_X, PEG_SPACING_Y, PEG_RADIUS, PEG_ROWS, GRAVITY, ANIMATION_SPEED } from './constants.js';


// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // Light gray background
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, -5, 15); // Moved higher and further back for better zoom

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -7, 0); // Set the target point for the camera to look at
controls.enableDamping = true; // smooth motion
controls.dampingFactor = 0.05;
controls.enableZoom = true;

// Physics
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -GRAVITY, 0),
});

// Enable sleep optimization for performance
world.allowSleep = true;

const material = new CANNON.Material();
world.defaultContactMaterial = new CANNON.ContactMaterial(material, material, {
  friction: 0.1,
  restitution: 0.4,
});

// Create pegs using the new class-based approach
const pegGrid = createPegGrid(scene, world, PEG_ROWS, PEG_SPACING_X, PEG_SPACING_Y, PEG_RADIUS);
const pegs = pegGrid;
const pegBodies = pegs.map(peg => peg.getBody());

// Create buckets below the last row of pegs
const buckets = createBuckets(scene, world, PEG_ROWS, PEG_SPACING_X, PEG_SPACING_Y);

// Ball management
const ballRadius = 0.2;
const balls = []; // Array to store all ball objects

const spawnBall = () => {
  const ball = Ball.createRandomBall(scene, world, ballRadius);
  ball.setupPegCollisionHandler(spawnBall);
  balls.push(ball);
  return ball;
};

// Spawn the first ball
spawnBall();

// Light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white ambient light
scene.add(ambientLight);

const light = new THREE.DirectionalLight(0xffffff, 5); // Reduced intensity since we have ambient
light.position.set(5, 10, 7.5);
light.castShadow = true; // Enable shadows for better depth perception
scene.add(light);

// Add a secondary light from a different angle for better illumination
const light2 = new THREE.DirectionalLight(0xffffff, 0.4);
light2.position.set(-5, 5, 5);
scene.add(light2);

// Animate
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  world.step(1 / 60, delta * ANIMATION_SPEED, 3);

  // Update all balls
  balls.forEach(ball => {
    ball.update();
    
    // Displacement-based sleep enforcement - only for balls that truly aren't moving
    if (ball.inBucket != null && ball.body.sleepState === CANNON.Body.AWAKE) {
      const displacement = ball.getDisplacementInLastSecond();
      if (displacement < 0.05) { // Ball hasn't moved much in the last second
        ball.body.sleep();
      }
    }
  });

  // Log sleep statistics periodically (every 3 seconds)
  const currentTime = performance.now();

  // Remove balls that fall too low (optional cleanup)
  for (let i = balls.length - 1; i >= 0; i--) {
    if (balls[i].getPosition().y < -25) {
      balls[i].destroy();
      balls.splice(i, 1);
      console.log('Ball removed for falling too low');
    }
    if (balls[i].body.type === CANNON.Body.STATIC) {
      balls.splice(i, 1);
      console.log('Ball removed for being static');
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();