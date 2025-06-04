import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Peg {
  constructor(scene, world, x, y, z = 0, radius = 0.25, row = 0) {
    this.scene = scene;
    this.world = world;
    this.x = x;
    this.y = y;
    this.z = z;
    this.radius = radius;
    this.row = row;
    this.count = 0;
    
    this.createPhysicsBody();
    this.createVisualMesh();
  }
  
  createPhysicsBody() {
    this.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(this.radius),
      position: new CANNON.Vec3(this.x, this.y, this.z),
      isTrigger: true, // Make this a sensor - detects collisions but doesn't apply physical response
    });
    
    // Store reference to this peg instance on the physics body
    this.body.userData = { peg: this };
    
    this.world.addBody(this.body);
  }
  
  createVisualMesh() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x8888ff })
    );
    this.mesh.position.copy(this.body.position);
    this.scene.add(this.mesh);
  }
  
  getBody() {
    return this.body;
  }
  
  reset() {
    this.count = 0;
  }
  
  destroy() {
    this.world.removeBody(this.body);
    this.scene.remove(this.mesh);
  }
}

export function createPegGrid(scene, world, pegRows, pegSpacingX, pegSpacingY, pegRadius) {
  const pegs = [];
  
  for (let i = 0; i < pegRows; i++) {
    const cols = i + 1; // Each row has one more peg than the previous
    
    for (let j = 0; j < cols; j++) {
      // Center the pegs in each row
      const x = (j - (cols - 1) / 2) * 2 * pegSpacingX;
      const y = -i * pegSpacingY;
      
      const peg = new Peg(scene, world, x, y, 0, pegRadius, i);
      pegs.push(peg);
      
    }
  }
  
  return pegs;
} 