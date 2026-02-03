import * as THREE from 'three';

// Helper to project a point on a cube face to a sphere surface
// face: 'px', 'nx', 'py', 'ny', 'pz', 'nz'
// u, v: coordinates on the face, range [-radius, radius]
// radius: sphere radius
export const projectToSphere = (
  u: number, 
  v: number, 
  radius: number, 
  face: 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'
): THREE.Vector3 => {
  const vec = new THREE.Vector3();

  switch (face) {
    case 'py': // Top
      vec.set(u, radius, v);
      break;
    case 'ny': // Bottom
      vec.set(u, -radius, -v); // Flip v to maintain orientation?
      break;
    case 'px': // Right
      vec.set(radius, -v, -u); // Rotate to align
      break;
    case 'nx': // Left
      vec.set(-radius, -v, u);
      break;
    case 'pz': // Front
      vec.set(u, -v, radius);
      break;
    case 'nz': // Back
      vec.set(-u, -v, -radius);
      break;
  }

  vec.normalize().multiplyScalar(radius);
  return vec;
};
