import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import {
  loadHeightMap,
  sampleHeight,
  getCylindricalUV,
} from '../utils/heightmap';
import type { HeightMapData } from '../utils/heightmap';

/**
 * ============================================================================
 * GEOMETRIC CONSTANTS
 * ============================================================================
 * We start with a Golden Ratio based Icosahedron as our base primitive.
 * An icosahedron is a regular polyhedron with 20 identical equilateral
 * triangular faces, 30 edges and 12 vertices.
 */
const t = (1 + Math.sqrt(5)) / 2;

const ICOSAHEDRON_VERTICES = [
  [-1, t, 0],
  [1, t, 0],
  [-1, -t, 0],
  [1, -t, 0],
  [0, -1, t],
  [0, 1, t],
  [0, -1, -t],
  [0, 1, -t],
  [t, 0, -1],
  [t, 0, 1],
  [-t, 0, -1],
  [-t, 0, 1],
].map((v) => new THREE.Vector3(...v).normalize());

const ICOSAHEDRON_FACES = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

/**
 * ============================================================================
 * SPHERICAL LINEAR INTERPOLATION (SLERP)
 * ============================================================================
 * Standard lerp (linear interpolation) doesn't work well on spheres because
 * it cuts through the volume. Slerp interpolates along the arc of the sphere,
 * maintaining a constant radius.
 */
function slerp(v1: THREE.Vector3, v2: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = Math.max(-1, Math.min(1, v1.dot(v2)));

  // If vectors are nearly identical, use standard lerp for stability
  if (dot > 0.9999) {
    return new THREE.Vector3().copy(v1).lerp(v2, t).normalize();
  }

  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const a = Math.sin((1 - t) * theta) / sinTheta;
  const b = Math.sin(t * theta) / sinTheta;

  return new THREE.Vector3().addScaledVector(v1, a).addScaledVector(v2, b);
}

interface PlanetProps {
  radius?: number;
  minDetail?: number;
  maxDetail?: number;
  steps?: number;
  stepGamma?: number;
  color?: string;
  wireframe?: boolean;
  position?: [number, number, number];
  targetPosition?: THREE.Vector3;
  heightMapUrl?: string;
  displacementScale?: number;
}

/**
 * ============================================================================
 * PLANET COMPONENT
 * ============================================================================
 * A dynamic, LOD-based planet renderer. It generates a spherical mesh
 * starting from an icosahedron and subdivides faces based on proximity
 * to a target position (e.g., the camera).
 */
export default function Planet({
  radius = 1,
  minDetail = 0,
  maxDetail = 20,
  steps = 2,
  stepGamma = 1,
  color = 'royalblue',
  wireframe = false,
  position = [0, 0, 0],
  targetPosition,
  heightMapUrl,
  displacementScale = 1,
}: PlanetProps) {
  // Heightmap data state for vertex displacement
  const [heightMapData, setHeightMapData] = useState<HeightMapData | null>(
    null,
  );

  // Load heightmap when URL changes
  useEffect(() => {
    if (heightMapUrl) {
      loadHeightMap(heightMapUrl).then(setHeightMapData);
    }
  }, [heightMapUrl]);

  /**
   * ============================================================================
   * GEOMETRY GENERATION
   * ============================================================================
   * This useMemo block contains the heavy lifting for generating the
   * planet's geometry. It recalculated whenever LOD parameters or
   * position change.
   */
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const vertexMap = new Map<string, number>();

    const planetCenter = new THREE.Vector3(...position);

    /**
     * LOD Calculation Function (getK)
     * Determines the subdivision level (k) for a given point on the sphere.
     * Higher k = more detail (smaller triangles).
     */
    const getK = (v: THREE.Vector3) => {
      // worldV is the point on the sphere in world space
      const worldV = v.clone().multiplyScalar(radius).add(planetCenter);
      // Default to top of sphere if no target provided
      const target = targetPosition || new THREE.Vector3(0, radius, 0);

      const dist = worldV.distanceTo(target);
      const maxDist = radius * 2;
      const t_dist = Math.max(0, Math.min(1, dist / maxDist));

      // detailFactor increases as distance decreases
      const detailFactor = Math.pow(1 - t_dist, stepGamma);
      const levelIndex = Math.min(steps - 1, Math.floor(detailFactor * steps));

      let res: number;
      if (steps <= 1) {
        res = maxDetail;
      } else {
        const stepSize = (maxDetail - minDetail) / (steps - 1);
        res = minDetail + levelIndex * stepSize;
      }
      return Math.max(1, Math.round(res));
    };

    /**
     * Vertex Index Management
     * Ensures we don't create duplicate vertices and applies height displacement.
     */
    function getVertexIndex(v: THREE.Vector3): number {
      const precision = 6;
      const key = `${v.x.toFixed(precision)},${v.y.toFixed(precision)},${v.z.toFixed(precision)}`;

      // Return existing index if vertex was already processed
      if (vertexMap.has(key)) return vertexMap.get(key)!;

      const index = vertices.length / 3;

      // Apply displacement from heightmap
      let d = 0;
      if (heightMapData) {
        const { u, v: uvV } = getCylindricalUV(v);
        d = sampleHeight(u, uvV, heightMapData) * displacementScale;
      }

      // Add displaced vertex position to array
      vertices.push(v.x * (radius + d), v.y * (radius + d), v.z * (radius + d));
      vertexMap.set(key, index);
      return index;
    }

    // Base subdivision level for all faces
    const baseSub = Math.max(1, Math.min(minDetail || 1, 5));

    /**
     * MAIN SUBDIVISION LOOP
     * 1. Iterate through base icosahedron faces.
     * 2. Subdivide each face into 'baseSub' chunks.
     * 3. For each chunk, calculate LOD (k) and generate a grid of vertices.
     * 4. Stitch vertices into triangles.
     */
    for (const faceIndices of ICOSAHEDRON_FACES) {
      const A = ICOSAHEDRON_VERTICES[faceIndices[0]];
      const B = ICOSAHEDRON_VERTICES[faceIndices[1]];
      const C = ICOSAHEDRON_VERTICES[faceIndices[2]];

      for (let i = 0; i < baseSub; i++) {
        for (let j = 0; j <= i; j++) {
          /**
           * processSubFace: Handles the actual grid generation for a
           * triangular patch.
           */
          const processSubFace = (
            v1: THREE.Vector3,
            v2: THREE.Vector3,
            v3: THREE.Vector3,
          ) => {
            const center = new THREE.Vector3()
              .add(v1)
              .add(v2)
              .add(v3)
              .divideScalar(3);
            const m12 = slerp(v1, v2, 0.5);
            const m13 = slerp(v1, v3, 0.5);
            const m23 = slerp(v2, v3, 0.5);

            // Determine max k among edges and center for consistent borders
            const k_f = getK(center);
            const k_e1 = getK(m12);
            const k_e2 = getK(m13);
            const k_e3 = getK(m23);
            const k = Math.max(k_f, k_e1, k_e2, k_e3);

            // Generate vertex grid for the patch
            const faceGrid: number[][] = [];
            for (let r = 0; r <= k; r++) {
              faceGrid[r] = [];
              const t_r = r / k;
              const rowStart = slerp(v1, v2, t_r);
              const rowEnd = slerp(v1, v3, t_r);

              for (let c = 0; c <= r; c++) {
                let v: THREE.Vector3;

                // Snap edges to ensure crack-free transitions between LOD levels
                if (r === k) {
                  const t = c / k;
                  const t_snapped = Math.round(t * k_e3) / k_e3;
                  v = slerp(v2, v3, t_snapped);
                } else if (c === 0) {
                  const t = r / k;
                  const t_snapped = Math.round(t * k_e1) / k_e1;
                  v = slerp(v1, v2, t_snapped);
                } else if (c === r) {
                  const t = r / k;
                  const t_snapped = Math.round(t * k_e2) / k_e2;
                  v = slerp(v1, v3, t_snapped);
                } else {
                  v = slerp(rowStart, rowEnd, r === 0 ? 0 : c / r);
                }
                faceGrid[r][c] = getVertexIndex(v);
              }
            }

            // Create triangles from the grid
            for (let r = 0; r < k; r++) {
              for (let c = 0; c < r; c++) {
                const i1 = faceGrid[r][c];
                const i2 = faceGrid[r + 1][c];
                const i3 = faceGrid[r + 1][c + 1];
                const i4 = faceGrid[r][c + 1];

                if (i1 !== i2 && i2 !== i3 && i3 !== i1)
                  indices.push(i1, i2, i3);
                if (i1 !== i3 && i3 !== i4 && i4 !== i1)
                  indices.push(i1, i3, i4);
              }
              const i1 = faceGrid[r][r];
              const i2 = faceGrid[r + 1][r];
              const i3 = faceGrid[r + 1][r + 1];
              if (i1 !== i2 && i2 !== i3 && i3 !== i1) indices.push(i1, i2, i3);
            }
          };

          // Calculate sub-patch corners
          const v1 = slerp(
            slerp(A, B, i / baseSub),
            slerp(A, C, i / baseSub),
            i === 0 ? 0 : j / i,
          );
          const v2 = slerp(
            slerp(A, B, (i + 1) / baseSub),
            slerp(A, C, (i + 1) / baseSub),
            j / (i + 1),
          );
          const v3 = slerp(
            slerp(A, B, (i + 1) / baseSub),
            slerp(A, C, (i + 1) / baseSub),
            (j + 1) / (i + 1),
          );
          processSubFace(v1, v2, v3);

          // Handle the "upside-down" triangle in the subdivision grid
          if (j < i) {
            const vd1 = v1;
            const vd2 = v3;
            const vd3 = slerp(
              slerp(A, B, i / baseSub),
              slerp(A, C, i / baseSub),
              (j + 1) / i,
            );
            processSubFace(vd1, vd2, vd3);
          }
        }
      }
    }

    // Finalize BufferGeometry
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(vertices), 3),
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [
    radius,
    minDetail,
    maxDetail,
    steps,
    stepGamma,
    color,
    position,
    targetPosition,
    heightMapData,
    displacementScale,
  ]);

  return (
    <group position={position}>
      {/* Primary Planet Mesh */}
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Optional Wireframe Overlay */}
      {wireframe && (
        <mesh geometry={geometry}>
          <meshBasicMaterial
            color="white"
            wireframe
            transparent
            opacity={0.3}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      )}
    </group>
  );
}
