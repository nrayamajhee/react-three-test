import { useMemo } from 'react';
import * as THREE from 'three';

interface GeometryClipmapProps {
  levels?: number;
  segments?: number;
  color?: string;
  wireframeColor?: string;
}

const createClipmapGeometry = (segments: number, isRing: boolean) => {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  // Grid size in terms of vertices is segments + 1
  const gridSize = segments + 1;
  const halfSegments = segments / 2;

  // Generate all vertices first (Standard grid)
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      // Coordinates centered at 0, spacing 1
      const px = x - halfSegments;
      const pz = z - halfSegments;
      
      vertices.push(px, 0, pz);
      uvs.push(x / segments, z / segments);
    }
  }

  const holeStart = segments / 4;
  const holeEnd = segments * 3 / 4;

  const isHole = (x: number, z: number) => {
    if (!isRing) return false;
    return x >= holeStart && x < holeEnd && z >= holeStart && z < holeEnd;
  };

  const getIdx = (x: number, z: number) => z * gridSize + x;

  // --- 1. Interior (Standard Quads) ---
  // Range: x, z from 1 to segments - 1 (Leaving 1-unit border for stitching)
  for (let z = 1; z < segments - 1; z++) {
    for (let x = 1; x < segments - 1; x++) {
      if (isHole(x, z)) continue;

      const a = getIdx(x, z);
      const b = getIdx(x + 1, z);
      const c = getIdx(x + 1, z + 1);
      const d = getIdx(x, z + 1);

      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  // --- 2. Stitch Strips (Edges) ---
  // Top Edge (z=0..1, x=2..N-2)
  for (let x = 2; x < segments - 2; x += 2) {
    // 2x1 Block: (x,0) to (x+2, 1)
    const A = getIdx(x, 0);
    const B = getIdx(x + 1, 0); // Skipped
    const C = getIdx(x + 2, 0);
    const D = getIdx(x, 1);
    const E = getIdx(x + 1, 1);
    const F = getIdx(x + 2, 1);

    // D-A-E, A-C-E, F-C-E (Standard Stitch Pattern)
    // Note: A-C is the boundary edge (Length 2)
    indices.push(D, A, E);
    indices.push(A, C, E);
    indices.push(F, C, E); // Changed order to maintain CCW? F(x+2,1), C(x+2,0), E(x+1,1).
    // CCW: E->C->F. 
    // E(x+1,1), C(x+2,0), F(x+2,1).
    // Check normals. 
    // A(0,0), C(2,0), E(1,1). (Up-Right). Normal Up.
    // D(0,1), A(0,0), E(1,1). (Up-Right). Normal Up.
    // E(1,1), C(2,0), F(2,1). (Right). Normal Up.
    // So F-C-E is CW? F(2,1), C(2,0), E(1,1).
    // Yes. So E-C-F is CCW.
  }
  // Correction: Rewriting indices with correct winding
  indices.length = 0; // Clear indices to restart logic cleanly

  // RESTART INDICES GENERATION
  
  // Helper to add triangle
  const addTri = (a: number, b: number, c: number) => indices.push(a, b, c);

  // --- 1. Interior ---
  for (let z = 1; z < segments - 1; z++) {
    for (let x = 1; x < segments - 1; x++) {
      if (isHole(x, z)) continue;
      const a = getIdx(x, z);
      const b = getIdx(x + 1, z);
      const c = getIdx(x + 1, z + 1);
      const d = getIdx(x, z + 1);
      addTri(a, d, b);
      addTri(b, d, c);
    }
  }

  // --- 2. Edges (Strips) ---
  // Top (z=0)
  for (let x = 2; x < segments - 2; x += 2) {
    const A = getIdx(x, 0), C = getIdx(x + 2, 0);
    const D = getIdx(x, 1), E = getIdx(x + 1, 1), F = getIdx(x + 2, 1);
    addTri(D, A, E);
    addTri(A, C, E);
    addTri(E, C, F);
  }

  // Bottom (z=segments-1) -> z range [N-1, N] ?? No, z range [N-2, N-1]?
  // Boundary is z=N. (Index segments).
  // Block z from segments-1 to segments? 
  // Wait, grid goes 0..segments.
  // Bottom boundary is z=segments.
  // Strip covers z=segments-1 to segments.
  const N = segments;
  for (let x = 2; x < N - 2; x += 2) {
    // Block: x..x+2, z=N-1..N
    // Row N-1 (Inner): D, E, F
    // Row N (Outer): A, C (B skipped)
    const D = getIdx(x, N - 1), E = getIdx(x + 1, N - 1), F = getIdx(x + 2, N - 1);
    const A = getIdx(x, N), C = getIdx(x + 2, N);
    
    // Stitching to A-C
    // Triangles: D-E-A, E-C-A, F-C-E?
    // Normals Up.
    // D(0, N-1), E(1, N-1), A(0, N).
    // D-A-E? D(0, N-1) -> A(0, N) -> E(1, N-1). CW?
    // D is Top-Left of block. A is Bot-Left. E is Top-Mid.
    // D->A->E is CCW.
    addTri(D, A, E);
    // E-A-C? E(1, N-1) -> A(0, N) -> C(2, N). CCW.
    addTri(E, A, C);
    // E-C-F? E(1, N-1) -> C(2, N) -> F(2, N-1). CW?
    // E-C-F. E(1, -1), C(2, 0), F(2, -1). (Relative)
    // Vector EC = (1, 1). EF = (1, 0). Cross = -1. CW.
    // So F-C-E? F(2, N-1) -> C(2, N) -> E(1, N-1). CCW.
    addTri(F, C, E); // Or E-F-C? No. F(2, N-1), C(2, N), E(1, N-1).
    // F->C is Down. C->E is Up-Left. E->F is Right.
  }

  // Left (x=0)
  // Strip x=0..1, z=2..N-2
  for (let z = 2; z < N - 2; z += 2) {
    // Block z..z+2
    // Col 1 (Inner): D, E, F
    // Col 0 (Outer): A, C
    const D = getIdx(1, z), E = getIdx(1, z + 1), F = getIdx(1, z + 2);
    const A = getIdx(0, z), C = getIdx(0, z + 2);

    // D(1,z), A(0,z), E(1,z+1).
    // D->A is Left. A->E is Right-Down. E->D is Up.
    // D-A-E: CCW? (1,0)->(0,0)->(1,1). Cross Up.
    addTri(D, A, E);
    // A-C-E: (0,0)->(0,2)->(1,1).
    // A->C Down. C->E Up-Right. E->A Up-Left. CCW.
    addTri(A, C, E);
    // E-C-F: (1,1)->(0,2)->(1,2).
    // E->C Left-Down. C->F Right. F->E Up. CCW.
    addTri(E, C, F);
  }

  // Right (x=N)
  // Strip x=N-1..N, z=2..N-2
  for (let z = 2; z < N - 2; z += 2) {
    const D = getIdx(N - 1, z), E = getIdx(N - 1, z + 1), F = getIdx(N - 1, z + 2);
    const A = getIdx(N, z), C = getIdx(N, z + 2);

    // D(N-1, z), A(N, z), E(N-1, z+1)
    // D->E Down. E->A Up-Right. A->D Left.
    // D-E-A? (0,0)->(0,1)->(1,0). CCW.
    addTri(D, E, A);
    // E-C-A: (0,1)->(1,2)->(1,0).
    // E->C Right-Down. C->A Up. A->E Left-Up. CCW.
    addTri(E, C, A);
    // E-F-C: (0,1)->(0,2)->(1,2).
    // E->F Down. F->C Right. C->E Left-Up. CCW.
    addTri(E, F, C);
  }

  // --- 3. Corners ---
  // TL (0,0) -> x=0..2, z=0..2
  {
    const i00 = getIdx(0,0), i20 = getIdx(2,0), i02 = getIdx(0,2);
    const i11 = getIdx(1,1); // Center
    const i21 = getIdx(2,1), i12 = getIdx(1,2); // Transitions
    // Tris:
    // 1. 00-11-02 (Left edge stitched)
    addTri(i00, i11, i02);
    // 2. 00-20-11 (Top edge stitched)
    addTri(i00, i20, i11);
    // 3. 20-21-11 (Right trans)
    addTri(i20, i21, i11);
    // 4. 02-11-12 (Bottom trans)
    addTri(i02, i11, i12);
  }

  // TR (N,0) -> x=N-2..N, z=0..2
  {
    const iN0 = getIdx(N,0), iN_20 = getIdx(N-2,0), iN2 = getIdx(N,2);
    const iN_11 = getIdx(N-1,1);
    const iN_21 = getIdx(N-2,1), iN_12 = getIdx(N-1,2);
    
    // 1. N0-N2-N_11 (Right edge stitched)
    addTri(iN0, iN2, iN_11);
    // 2. N0-N_11-N_20 (Top edge stitched)
    addTri(iN0, iN_11, iN_20);
    // 3. N_20-N_21-N_11 (Left trans)
    addTri(iN_20, iN_21, iN_11);
    // 4. N2-N_12-N_11 (Bottom trans)
    addTri(iN2, iN_12, iN_11);
  }

  // BL (0,N) -> x=0..2, z=N-2..N
  {
    const i0N = getIdx(0,N), i2N = getIdx(2,N), i0N_2 = getIdx(0,N-2);
    const i1N_1 = getIdx(1,N-1);
    const i2N_1 = getIdx(2,N-1), i1N_2 = getIdx(1,N-2);
    
    // 1. 0N-0N_2-1N_1 (Left edge stitched)
    addTri(i0N, i0N_2, i1N_1);
    // 2. 0N-1N_1-2N (Bottom edge stitched)
    addTri(i0N, i1N_1, i2N);
    // 3. 2N-2N_1-1N_1 (Right trans)
    addTri(i2N, i2N_1, i1N_1);
    // 4. 0N_2-1N_1-1N_2 (Top trans)
    addTri(i0N_2, i1N_1, i1N_2);
  }

  // BR (N,N) -> x=N-2..N, z=N-2..N
  {
    const iNN = getIdx(N,N), iN_2N = getIdx(N-2,N), iNN_2 = getIdx(N,N-2);
    const iN_1N_1 = getIdx(N-1,N-1);
    const iN_2N_1 = getIdx(N-2,N-1), iN_1N_2 = getIdx(N-1,N-2);
    
    // 1. NN-N_1N_1-NN_2 (Right edge stitched)
    addTri(iNN, iN_1N_1, iNN_2);
    // 2. NN-N_2N-N_1N_1 (Bottom edge stitched)
    addTri(iNN, iN_2N, iN_1N_1);
    // 3. N_2N-N_2N_1-N_1N_1 (Left trans)
    addTri(iN_2N, iN_2N_1, iN_1N_1);
    // 4. NN_2-N_1N_2-N_1N_1 (Top trans)
    addTri(iNN_2, iN_1N_2, iN_1N_1);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
};

function ClipmapLevel({ 
  level, 
  geometry, 
  color, 
  wireframeColor 
}: { 
  level: number; 
  geometry: THREE.BufferGeometry; 
  color: string; 
  wireframeColor: string;
}) {
  // Each level is scaled by 2^level
  // Level 0: Scale 1
  // Level 1: Scale 2 (but is a ring)
  const scale = Math.pow(2, level);

  return (
    <group scale={[scale, 1, scale]}>
      {/* Base mesh with standard material */}
      <mesh geometry={geometry}>
        <meshStandardMaterial 
          color={color} 
          side={THREE.DoubleSide} 
          polygonOffset 
          polygonOffsetFactor={1} 
          polygonOffsetUnits={1}
          flatShading
        />
      </mesh>
      
      {/* Wireframe overlay */}
      <mesh geometry={geometry}>
        <meshBasicMaterial 
          color={wireframeColor} 
          wireframe 
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default function GeometryClipmap({
  levels = 7,
  segments = 64,
  color = "#8B4513",
  wireframeColor = "#DEB887"
}: GeometryClipmapProps) {
  
  // Memoize geometries
  // Level 0 is a full filled grid
  const fullGeometry = useMemo(() => createClipmapGeometry(segments, false), [segments]);
  
  // Levels 1..N are rings (filled grid with center hole)
  const ringGeometry = useMemo(() => createClipmapGeometry(segments, true), [segments]);

  return (
    <group>
      {Array.from({ length: levels }).map((_, i) => (
        <ClipmapLevel
          key={i}
          level={i}
          geometry={i === 0 ? fullGeometry : ringGeometry}
          color={color}
          wireframeColor={wireframeColor}
        />
      ))}
    </group>
  );
}
