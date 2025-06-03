import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { createBuckets } from './buckets.js';
import { Ball, wakeUpStats } from './balls.js';
import { createPegGrid } from './pegs.js';

// Physics constants
const GRAVITY = 19.64; // Doubled gravity for faster animation (was 9.82)
const ANIMATION_SPEED = 20.0; // Increase this value to speed up the animation

// Layout constants
const PEG_SPACING_X = 1.2
const PEG_SPACING_Y = 2
const PEG_RADIUS = 0.25
const PEG_ROWS = 6;


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

  // Add collision event listener to the ball
  ball.addCollisionListener((event) => {
    const { target, body } = event;
    
    // Check if the collision is with one of the big balls (pegs)
    if (pegBodies.includes(body)) {
      const peg = body.userData.peg;

      // Max height to aim for - random between 0.25x and 2x peg spacings
      const yMax = PEG_SPACING_Y + 0.25 + (0.75 * Math.random() * PEG_SPACING_Y);
      
      // Upwards velocity required to reach max height
      const vy = Math.sqrt(2 * GRAVITY * (yMax - PEG_SPACING_Y));
      
      // Time to reach max height and fall back to ground
      const tUp = vy / GRAVITY;
      const tDown = Math.sqrt(2 * yMax / GRAVITY);
      const tTotal = tUp + tDown;

      // Horizontal velocity required to reach target
      const vx = PEG_SPACING_X / tTotal;

      const direction = Math.random() < 0.5 ? -1 : 1;

      ball.setVelocity(vx * direction, vy, 0);

      // If this collision is with a row 1 peg, spawn a new ball
      if (peg.row === 1) {
        spawnBall();
      }
    }
  });

  // Store the ball object
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
let lastSleepLog = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  world.step(1 / 60, delta * ANIMATION_SPEED, 3);

  // Update all balls
  balls.forEach(ball => {
    ball.update();
    
    // Displacement-based sleep enforcement - only for balls that truly aren't moving
    const ballAge = performance.now() - ball.spawnTime;
    if (ballAge > 3000 && ball.body.sleepState === CANNON.Body.AWAKE) { // 3 seconds old
      const displacement = ball.getDisplacementInLastSecond();
      if (displacement < 0.05) { // Ball hasn't moved much in the last second
        ball.body.sleep();
        console.log(`Ball ${ball.id} forced to sleep - minimal displacement: ${displacement.toFixed(3)}`);
      }
    }
  });

  // Log sleep statistics periodically (every 3 seconds)
  const currentTime = performance.now();
  if (currentTime - lastSleepLog > 3000) {
    const awakeCount = balls.filter(ball => ball.body.sleepState === CANNON.Body.AWAKE).length;
    const sleepyCount = balls.filter(ball => ball.body.sleepState === CANNON.Body.SLEEPY).length;
    const sleepingCount = balls.filter(ball => ball.body.sleepState === CANNON.Body.SLEEPING).length;
    
    console.log(`Sleep Stats - Total: ${balls.length}`);
    console.log(`  States: Awake: ${awakeCount}, Sleepy: ${sleepyCount}, Sleeping: ${sleepingCount}`);
    console.log(`  Smart Wake-ups: Allowed: ${wakeUpStats.smartWakeUpCount}, Prevented: ${wakeUpStats.preventedWakeUpCount}`);
    
    lastSleepLog = currentTime;
  }

  // Remove balls that fall too low (optional cleanup)
  for (let i = balls.length - 1; i >= 0; i--) {
    if (balls[i].getPosition().y < -25) {
      balls[i].destroy();
      balls.splice(i, 1);
      console.log('Ball removed for falling too low');
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();