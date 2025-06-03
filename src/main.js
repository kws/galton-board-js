import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

// Physics constants
const GRAVITY = 9.82;

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
  gravity: new CANNON.Vec3(0, -GRAVITY, 0),
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
    isTrigger: true, // Make this a sensor - detects collisions but doesn't apply physical response
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

const rows = 5;
for (let i = 0; i < rows; i++) {
  const cols = i + 1; // Each row has one more peg than the previous
  
  for (let j = 0; j < cols; j++) {
    // Center the pegs in each row
    const x = (j - (cols - 1) / 2) * 2 * PEG_SPACING_X;
    const y = -i * PEG_SPACING_Y;
    createPeg(x, y);
  }
}

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

    console.log(`vx: ${vx}, vy: ${vy}, tTotal: ${tTotal}`);

    const direction = Math.random() < 0.5 ? -1 : 1;

    ballBody.velocity.set(vx * direction, vy, 0);


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