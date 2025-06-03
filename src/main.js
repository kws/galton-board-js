import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // smooth motion
controls.dampingFactor = 0.05;
controls.enableZoom = true;

// Physics
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0),
});

const material = new CANNON.Material();
world.defaultContactMaterial = new CANNON.ContactMaterial(material, material, {
  friction: 0.1,
  restitution: 0.4,
});

// Store references to the big ball bodies for collision detection
const bigBallBodies = [];

const PEG_SPACING_X = 1.2
const PEG_SPACING_Y = 2
const PEG_RADIUS = 0.25

const createPeg = (x,y) => {
  // Ground ball
  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Sphere(PEG_RADIUS),
    position: new CANNON.Vec3(x, y, 0),
  });
  world.addBody(groundBody);
  
  // Store reference to the big ball body
  bigBallBodies.push(groundBody);

  const groundMesh = new THREE.Mesh(
    new THREE.SphereGeometry(PEG_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x8888ff })
  );
  groundMesh.position.copy(groundBody.position);
  scene.add(groundMesh);
};
createPeg(0, 0);
createPeg(-PEG_SPACING_X, -PEG_SPACING_Y);
createPeg(PEG_SPACING_X, -PEG_SPACING_Y);



// Small falling ball
const ballRadius = 0.2;
const ballBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Sphere(ballRadius),
  position: new CANNON.Vec3(0, 2, 0),
});

// Disable damping to prevent air resistance from affecting trajectory
ballBody.linearDamping = 0;
ballBody.angularDamping = 0;

world.addBody(ballBody);

// Add collision event listener to the small ball
ballBody.addEventListener('collide', (event) => {
  const { target, body } = event;
  
  // Check if the collision is with one of the big balls
  if (bigBallBodies.includes(body)) {
    // Store collision position for debugging
    const collisionX = ballBody.position.x;
    const collisionY = ballBody.position.y;
    
    // Physics parameters
    const gravity = 9.82;
    const initialUpwardVelocity = 4.0; // Fixed initial velocity for consistent bouncing
    
    // Use kinematic equation to find time when ball reaches target level:
    // y = v0*t - (1/2)*g*t^2
    // We want to solve for when y = -PEG_SPACING_Y (below current position)
    // Rearranging: (1/2)*g*t^2 - v0*t - PEG_SPACING_Y = 0
    // Using quadratic formula: t = (v0 + sqrt(v0^2 + 2*g*PEG_SPACING_Y)) / g
    
    const discriminant = initialUpwardVelocity * initialUpwardVelocity + 2 * gravity * PEG_SPACING_Y;
    const timeToTarget = (initialUpwardVelocity + Math.sqrt(discriminant)) / gravity;
    
    // Calculate horizontal velocity to move exactly PEG_SPACING_X in that time
    const horizontalSpeed = PEG_SPACING_X / timeToTarget;
    
    // Randomly choose left or right direction
    const direction = Math.random() < 0.5 ? -1 : 1;
    
    // Set the velocities
    ballBody.velocity.x = direction * horizontalSpeed;
    ballBody.velocity.y = initialUpwardVelocity;
    ballBody.velocity.z = 0;
    
    // Debug output
    console.log(`=== PEG COLLISION ===`);
    console.log(`Collision at: (${collisionX.toFixed(2)}, ${collisionY.toFixed(2)})`);
    // console.log(`Direction: ${direction > 0 ? 'RIGHT' : 'LEFT'}`);
    // console.log(`Target distance: ${PEG_SPACING_X}`);
    // console.log(`Target position: (${(collisionX + direction * PEG_SPACING_X).toFixed(2)}, ${(collisionY - PEG_SPACING_Y).toFixed(2)})`);
    // console.log(`Initial upward velocity: ${initialUpwardVelocity}`);
    // console.log(`Time to target: ${timeToTarget.toFixed(2)}s`);
    // console.log(`Horizontal speed: ${horizontalSpeed.toFixed(2)}`);
    // console.log(`Expected max height: ${(initialUpwardVelocity * initialUpwardVelocity / (2 * gravity)).toFixed(2)}`);
    
    // Set up a timeout to check where the ball actually lands
    setTimeout(() => {
      const actualX = ballBody.position.x;
      const actualY = ballBody.position.y;
      const actualDistance = Math.abs(actualX - collisionX);
      // console.log(`=== ACTUAL LANDING ===`);
      // console.log(`Landed at: (${actualX.toFixed(2)}, ${actualY.toFixed(2)})`);
      // console.log(`Actual distance traveled: ${actualDistance.toFixed(2)}`);
      // console.log(`Distance error: ${(actualDistance - PEG_SPACING_X).toFixed(2)}`);
      // console.log(`Center-to-center distance to target peg: ${Math.abs(actualX - (collisionX + direction * PEG_SPACING_X)).toFixed(2)}`);
    }, timeToTarget * 1000 + 100); // Wait for calculated time plus small buffer
  }
});

const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0xff4444 })
);
scene.add(ballMesh);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

// Animate
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  world.step(1 / 60, delta, 3);

  // Reset ball if it falls too low
  if (ballBody.position.y < -10) {
    ballBody.position.set(0, 2, 0);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    console.log('Ball reset to start position');
  }

  ballMesh.position.copy(ballBody.position);
  ballMesh.quaternion.copy(ballBody.quaternion);

  controls.update();
  renderer.render(scene, camera);
}
animate();