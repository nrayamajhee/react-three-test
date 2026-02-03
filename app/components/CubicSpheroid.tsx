import React, { useMemo } from "react";
import * as THREE from "three";

// Types
type NeighborResolutions = [number, number, number, number]; // Top, Bottom, Left, Right

interface SpheroidFaceProps {
  segments: number;
  neighborSegments: NeighborResolutions;
  position: [number, number, number];
  rotation: [number, number, number];
}

function StitchedFace({ segments, neighborSegments, position, rotation }: SpheroidFaceProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Face transformation matrix
    const mat = new THREE.Matrix4();
    const rot = new THREE.Euler(...rotation);
    const pos = new THREE.Vector3(...position);
    mat.makeRotationFromEuler(rot);
    mat.setPosition(pos);

    // 1. Generate ALL vertices (Uniform Grid)
    // We generate the full high-res grid. The stitching only affects which indices we use.
    
    // Grid maps (x, y) index to vertex index
    const getVertIndex = (x: number, y: number) => y * (segments + 1) + x;

    for (let iy = 0; iy <= segments; iy++) {
      const v = iy / segments;
      for (let ix = 0; ix <= segments; ix++) {
        const u = ix / segments;
        
        // Base plane position (-0.5 to 0.5)
        const localP = new THREE.Vector3(u - 0.5, v - 0.5, 0);
        const worldP = localP.applyMatrix4(mat);
        // Normalize to sphere radius 0.5
        const finalPos = worldP.normalize().multiplyScalar(0.5);
        
        vertices.push(finalPos.x, finalPos.y, finalPos.z);
      }
    }
    
    // 2. Determine Stitching Flags
    const [nTop, nBottom, nLeft, nRight] = neighborSegments;
    const stitchTop = segments > nTop;
    const stitchBottom = segments > nBottom;
    const stitchLeft = segments > nLeft;
    const stitchRight = segments > nRight;

    // Helper to track visited cells to avoid double-processing blocks
    const visited = new Array(segments).fill(0).map(() => new Array(segments).fill(false));

    // 3. Generate Indices using Tiling Logic
    for (let y = 0; y < segments; y++) {
      for (let x = 0; x < segments; x++) {
        if (visited[y][x]) continue;

        let w = 1;
        let h = 1;

        // Determine block size based on stitching requirements
        // Check Bottom Edge
        if (y === 0 && stitchBottom) {
          w = 2;
        }
        // Check Top Edge
        if (y === segments - 1 && stitchTop) {
          // If we are at the top row and need stitching, we form a 2-wide block?
          // Stitching reduces resolution. So we need 1 fewer vertex on the edge.
          // Yes, grouping 2 cells into a 2x1 block allows us to skip the middle edge vertex.
          w = 2;
        }

        // Check Left Edge
        if (x === 0 && stitchLeft) {
          h = 2;
        }
        // Check Right Edge
        if (x === segments - 1 && stitchRight) {
          h = 2;
        }

        // Handle Corner Intersections (2x2 blocks)
        // If both w=2 and h=2, we have a corner.
        // Logic check:
        // BL Corner: x=0, y=0. If stitchBottom & stitchLeft -> w=2, h=2.
        // TR Corner: x=seg-1, y=seg-1. If stitchTop & stitchRight -> w=2, h=2.
        
        // Safety: Ensure we don't exceed bounds (though logic implies segments is power of 2)
        if (x + w > segments) w = 1; // Fallback if grid doesn't align
        if (y + h > segments) h = 1;

        // Mark covered cells
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            visited[y + dy][x + dx] = true;
          }
        }

        // Generate Triangles for the block
        const v00 = getVertIndex(x, y);
        const v10 = getVertIndex(x + 1, y);
        const v20 = getVertIndex(x + 2, y);
        
        const v01 = getVertIndex(x, y + 1);
        const v11 = getVertIndex(x + 1, y + 1);
        const v21 = getVertIndex(x + 2, y + 1);
        
        const v02 = getVertIndex(x, y + 2);
        const v12 = getVertIndex(x + 1, y + 2);
        const v22 = getVertIndex(x + 2, y + 2);

        if (w === 1 && h === 1) {
          // Standard Quad (2 triangles)
          // 00 -- 10
          // |     |
          // 01 -- 11
          // Tri 1: 00, 10, 01 (BL, BR, TL) ?? No, grid is Y-up?
          // y=0 is bottom.
          // 01 (TL) -- 11 (TR)
          // |          |
          // 00 (BL) -- 10 (BR)
          // Indices: (BL, BR, TL), (BR, TR, TL)
          indices.push(v00, v10, v01);
          indices.push(v10, v11, v01);
        }
        else if (w === 2 && h === 1) {
          // 2x1 Horizontal Block (Bottom/Top Stitch)
          // Creates 3 triangles, skipping middle vertex on the stitched edge.
          
          if (y === 0) { 
             // Bottom Stitch (Skip v10)
             // Row 1: v01, v11, v21
             // Row 0: v00, [v10], v20
             // Tris:
             // 1. v00 - v11 - v01
             // 2. v00 - v20 - v11 (The bridge)
             // 3. v20 - v21 - v11
             indices.push(v00, v11, v01);
             indices.push(v00, v20, v11);
             indices.push(v20, v21, v11);
          } else {
             // Top Stitch (Skip v11) -> Wait, local indices are relative to block start (x,y)
             // If y = segments-1, block is y to y+1.
             // Top edge is y+1.
             // Row 1 (Top): v01, [v11], v21
             // Row 0 (Bot): v00, v10, v20
             // Tris:
             // 1. v00 - v10 - v01
             // 2. v01 - v10 - v21 (The bridge)
             // 3. v10 - v20 - v21
             indices.push(v00, v10, v01);
             indices.push(v01, v10, v21);
             indices.push(v10, v20, v21);
          }
        }
        else if (w === 1 && h === 2) {
          // 1x2 Vertical Block (Left/Right Stitch)
          
          if (x === 0) {
            // Left Stitch (Skip v01)
            // Col 0: v00, [v01], v02
            // Col 1: v10, v11, v12
            // Tris:
            // 1. v00 - v10 - v11
            // 2. v00 - v11 - v02 (The bridge)
            // 3. v02 - v11 - v12
            indices.push(v00, v10, v11);
            indices.push(v00, v11, v02);
            indices.push(v02, v11, v12);
          } else {
            // Right Stitch (Skip v11) -> local relative to x
            // Right edge is Col 1.
            // Col 0: v00, v01, v02
            // Col 1: v10, [v11], v12
            // Tris:
            // 1. v00 - v10 - v01
            // 2. v01 - v10 - v12 (Bridge)
            // 3. v01 - v12 - v02
            indices.push(v00, v10, v01);
            indices.push(v01, v10, v12);
            indices.push(v01, v12, v02);
          }
        }
        else if (w === 2 && h === 2) {
          // 2x2 Corner Block
          // We need to stitch TWO edges.
          // Center is v11.
          
          // Identify which edges are stitched based on coordinates
          const stitchB = (y === 0);
          const stitchT = (y === segments - 2); // 2x2 block starts at seg-2
          const stitchL = (x === 0);
          const stitchR = (x === segments - 2);

          // Example: Bottom-Left (Stitch Bottom & Left)
          // Skip v10 (Bottom) and v01 (Left).
          // Outer loop: v00 -> v20 -> v21 -> v22 -> v12 -> v02 -> loop
          // Center: v11
          // Tris:
          // 1. v00 - v20 - v11 (Bottom Bridge)
          // 2. v20 - v21 - v11
          // 3. v21 - v22 - v11
          // 4. v22 - v12 - v11
          // 5. v12 - v02 - v11
          // 6. v02 - v00 - v11 (Left Bridge)
          
          // We can construct a fan around v11.
          
          // BL Corner (Stitch Bottom & Left)
          if (stitchB && stitchL) {
             indices.push(v00, v20, v11); // Bot
             indices.push(v20, v21, v11);
             indices.push(v21, v22, v11);
             indices.push(v22, v12, v11);
             indices.push(v12, v02, v11);
             indices.push(v02, v00, v11); // Left
          }
          // BR Corner (Stitch Bottom & Right) -> Skip v10, v21
          else if (stitchB && stitchR) {
             // v20 is corner. v10 skipped. v21 skipped.
             // Edges: v00-v20 (Bot), v20-v22 (Right)
             indices.push(v00, v20, v11); // Bot bridge
             indices.push(v20, v22, v11); // Right bridge
             indices.push(v22, v12, v11);
             indices.push(v12, v02, v11);
             indices.push(v02, v01, v11);
             indices.push(v01, v00, v11);
          }
          // TL Corner (Stitch Top & Left) -> Skip v12, v01
          else if (stitchT && stitchL) {
             // v02 is corner. v12 skipped (Top). v01 skipped (Left).
             indices.push(v00, v10, v11);
             indices.push(v10, v20, v11);
             indices.push(v20, v21, v11);
             indices.push(v21, v22, v11);
             indices.push(v22, v02, v11); // Top bridge
             indices.push(v02, v00, v11); // Left bridge
          }
          // TR Corner (Stitch Top & Right) -> Skip v12, v21
          else if (stitchT && stitchR) {
             // v22 is corner. v12 skipped (Top). v21 skipped (Right).
             indices.push(v00, v10, v11);
             indices.push(v10, v20, v11);
             indices.push(v20, v22, v11); // Right bridge
             indices.push(v22, v02, v11); // Top bridge
             indices.push(v02, v01, v11);
             indices.push(v01, v00, v11);
          }
        }
      }
    }
    
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    
    return geo;
  }, [segments, neighborSegments, position, rotation]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial 
          color="#888888" 
          flatShading 
          side={THREE.DoubleSide} 
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial 
          color="white" 
          wireframe 
        />
      </mesh>
    </group>
  );
}

export function CubicSpheroid() {
  const scale = 1000;

  // Configuration for resolutions (Powers of 2 recommended)
  const RES_TOP = 8;
  const RES_SIDE = 4;
  const RES_BOTTOM = 2;
  
  return (
    <group position={[0, -500, 0]} scale={[scale, scale, scale]}>
      {/* Top Face - Segments 8 */}
      <StitchedFace 
        segments={RES_TOP} 
        neighborSegments={[RES_SIDE, RES_SIDE, RES_SIDE, RES_SIDE]}
        position={[0, 0.5, 0]} 
        rotation={[-Math.PI / 2, 0, 0]} 
      />
      
      {/* Bottom Face - Segments 2 */}
      <StitchedFace 
        segments={RES_BOTTOM} 
        neighborSegments={[RES_SIDE, RES_SIDE, RES_SIDE, RES_SIDE]}
        position={[0, -0.5, 0]} 
        rotation={[Math.PI / 2, 0, 0]} 
      />
      
      {/* Side Faces - Segments 4 */}
      {/* Front */}
      <StitchedFace 
        segments={RES_SIDE} 
        neighborSegments={[RES_TOP, RES_BOTTOM, RES_SIDE, RES_SIDE]}
        position={[0, 0, 0.5]} 
        rotation={[0, 0, 0]} 
      />
      {/* Back */}
      <StitchedFace 
        segments={RES_SIDE} 
        neighborSegments={[RES_TOP, RES_BOTTOM, RES_SIDE, RES_SIDE]}
        position={[0, 0, -0.5]} 
        rotation={[0, Math.PI, 0]} 
      />
      {/* Left */}
      <StitchedFace 
        segments={RES_SIDE} 
        neighborSegments={[RES_TOP, RES_BOTTOM, RES_SIDE, RES_SIDE]}
        position={[-0.5, 0, 0]} 
        rotation={[0, -Math.PI / 2, 0]} 
      />
      {/* Right */}
      <StitchedFace 
        segments={RES_SIDE} 
        neighborSegments={[RES_TOP, RES_BOTTOM, RES_SIDE, RES_SIDE]}
        position={[0.5, 0, 0]} 
        rotation={[0, Math.PI / 2, 0]} 
      />
    </group>
  );
}
