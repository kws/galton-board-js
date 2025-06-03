import * as THREE from 'three';
import * as CANNON from 'cannon-es';

let ballIdCounter = 0;

// Global counters for smart wake-up statistics
export const wakeUpStats = {
  smartWakeUpCount: 0,
  preventedWakeUpCount: 0,
  reset() {
    this.smartWakeUpCount = 0;
    this.preventedWakeUpCount = 0;
  }
};

export class Ball {
  constructor(scene, world, x = 0, y = 2, z = 0, radius = 0.2) {
    this.id = ballIdCounter++;
    this.scene = scene;
    this.world = world;
    this.radius = radius;
    this.inBucket = null;
    this.lastWakeTime = 0; // Track when this ball was last woken up
    this.spawnTime = performance.now(); // Track when this ball was created
    
    // Position tracking for displacement measurement
    this.positionHistory = [];
    this.lastDisplacementCheck = performance.now();
    
    this.createPhysicsBody(x, y, z);
    this.createVisualMesh();
    this.setupSmartWakeUp();
  }
  
  createPhysicsBody(x, y, z) {
    this.body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(this.radius),
      position: new CANNON.Vec3(x, y, z),
      allowSleep: true,
      sleepSpeedLimit: 0.05, // Lower threshold for considering ball sleepy (default: 0.1)
      sleepTimeLimit: 0.5,   // Time in seconds before sleepy ball goes to sleep (default: 1)
    });

    // Disable damping to prevent air resistance from affecting trajectory
    this.body.linearDamping = 0;
    this.body.angularDamping = 0;
    
    // Store reference to this ball instance on the physics body
    this.body.userData = { ball: this };

    this.world.addBody(this.body);
  }
  
  setupSmartWakeUp() {
    // Override the default collision behavior to implement smart wake-up
    this.body.addEventListener('collide', (event) => {
      this.handleSmartWakeUp(event);
    });
  }
  
  handleSmartWakeUp(event) {
    const { target, body, contact } = event;
    const otherBall = body.userData?.ball;
    
    // Only apply smart wake-up logic to ball-to-ball collisions
    if (!otherBall) return;
    
    // Get actual displacement and speed rather than just instantaneous velocity
    const otherBallSpeed = otherBall.body.velocity.length();
    const otherBallDisplacement = otherBall.getDisplacementInLastSecond();
    const otherBallAvgSpeed = otherBall.getAverageSpeed();
    
    const thisSpeed = this.body.velocity.length();
    const thisDisplacement = this.getDisplacementInLastSecond();
    
    // More sophisticated wake-up logic based on actual movement:
    // 1. High displacement = truly moving ball
    // 2. Low displacement but high velocity = jiggling ball
    const SIGNIFICANT_DISPLACEMENT = 0.5; // Ball must have moved this far in the last second
    const MINIMUM_AVG_SPEED = 1.0; // Average speed over the last second
    
    const ballAge = performance.now() - this.spawnTime;
    const otherBallAge = performance.now() - otherBall.spawnTime;
    const bothBallsOld = ballAge > 2000 && otherBallAge > 2000;
    
    // Ball is truly moving if it has significant displacement OR good average speed
    const otherBallTrulyMoving = otherBallDisplacement > SIGNIFICANT_DISPLACEMENT || 
                                otherBallAvgSpeed > MINIMUM_AVG_SPEED;
    
    // Allow wake-up if the other ball is truly moving, or if either ball is young
    const shouldWakeUp = otherBallTrulyMoving || !bothBallsOld;
    
    if (shouldWakeUp) {
      // Allow wake up
      if (this.body.sleepState !== CANNON.Body.AWAKE) {
        this.body.wakeUp();
        this.lastWakeTime = performance.now();
        wakeUpStats.smartWakeUpCount++;
        console.log(`Ball ${this.id} woken by ball ${otherBall.id} (disp: ${otherBallDisplacement.toFixed(2)}, avgSpeed: ${otherBallAvgSpeed.toFixed(2)})`);
      }
    } else {
      // Prevent wake-up for jiggling balls
      wakeUpStats.preventedWakeUpCount++;
      
      // Gently encourage sleep for balls that aren't really moving
      if (ballAge > 3000 && thisDisplacement < 0.1) {
        this.forceSleep();
      }
      if (otherBallAge > 3000 && otherBallDisplacement < 0.1) {
        otherBall.forceSleep();
      }
      
      console.log(`Prevented jiggle wake-up: Ball ${this.id} hit by jiggling ball ${otherBall.id} (disp: ${otherBallDisplacement.toFixed(2)})`);
    }
  }
  
  forceSleep() {
    // Immediately put the ball to sleep if it's moving slowly
    if (this.body.velocity.length() < 1.0) {
      this.body.sleep();
    } else {
      // If still moving, schedule a sleep check very soon
      setTimeout(() => {
        if (this.body.velocity.length() < 0.5) {
          this.body.sleep();
        }
      }, 5);
    }
  }
  
  createVisualMesh() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xff4444 })
    );
    this.scene.add(this.mesh);
  }
  
  update() {
    // Update visual mesh position and rotation from physics body
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    
    // Track position for displacement calculation
    this.updatePositionHistory();
    
    // Update color based on sleep state
    this.updateSleepColor();
  }
  
  updatePositionHistory() {
    const now = performance.now();
    const currentPos = this.body.position.clone();
    
    // Add current position to history with timestamp
    this.positionHistory.push({
      position: currentPos,
      time: now
    });
    
    // Keep only the last 1 second of history
    const cutoffTime = now - 1000;
    this.positionHistory = this.positionHistory.filter(entry => entry.time > cutoffTime);
  }
  
  getDisplacementInLastSecond() {
    if (this.positionHistory.length < 2) return 0;
    
    const newest = this.positionHistory[this.positionHistory.length - 1];
    const oldest = this.positionHistory[0];
    
    return newest.position.distanceTo(oldest.position);
  }
  
  getAverageSpeed() {
    if (this.positionHistory.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < this.positionHistory.length; i++) {
      const dist = this.positionHistory[i].position.distanceTo(this.positionHistory[i-1].position);
      totalDistance += dist;
    }
    
    const timeSpan = (this.positionHistory[this.positionHistory.length - 1].time - this.positionHistory[0].time) / 1000; // Convert to seconds
    return timeSpan > 0 ? totalDistance / timeSpan : 0;
  }
  
  updateSleepColor() {
    const material = this.mesh.material;
    
    switch (this.body.sleepState) {
      case CANNON.Body.AWAKE:
        material.color.setHex(0xff4444); // Bright red - active
        break;
      case CANNON.Body.SLEEPY:
        material.color.setHex(0xff8844); // Orange - getting sleepy
        break;
      case CANNON.Body.SLEEPING:
        material.color.setHex(0x661111); // Dark red - sleeping
        break;
      default:
        material.color.setHex(0xff4444); // Default to bright red
    }
  }
  
  setVelocity(x, y, z) {
    this.body.velocity.set(x, y, z);
  }
  
  getPosition() {
    return this.body.position;
  }
  
  addCollisionListener(callback) {
    this.body.addEventListener('collide', callback);
  }
  
  destroy() {
    this.world.removeBody(this.body);
    this.scene.remove(this.mesh);
  }
  
  static createRandomBall(scene, world, radius = 0.2) {
    return new Ball(scene, world, 0, 2, 0, radius);
  }
} 