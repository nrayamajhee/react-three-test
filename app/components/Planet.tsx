import { useMemo } from 'react';
import * as THREE from 'three';

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
 * Spherical Linear Interpolation between two vectors.
 */
function slerp(v1: THREE.Vector3, v2: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = Math.max(-1, Math.min(1, v1.dot(v2)));

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
}

export default function Planet({
  radius = 1,
  minDetail = 0,
  maxDetail = 20,
  steps = 2,
  stepGamma = 1,
  color = 'royalblue',
  wireframe = false,
  position = [0, 0, 0],
}: PlanetProps) {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const vertexMap = new Map<string, number>();

    const getK = (v: THREE.Vector3) => {
      const t_height = (v.y + 1) / 2;
      const biasedHeight = Math.pow(t_height, stepGamma);
      const levelIndex = Math.min(steps - 1, Math.floor(biasedHeight * steps));

      let res: number;
      if (steps <= 1) {
        res = maxDetail;
      } else {
        const stepSize = (maxDetail - minDetail) / (steps - 1);
        res = minDetail + levelIndex * stepSize;
      }
      return Math.max(1, Math.round(res));
    };

    function getVertexIndex(v: THREE.Vector3): number {
      const precision = 6;
      const key = `${v.x.toFixed(precision)},${v.y.toFixed(precision)},${v.z.toFixed(precision)}`;
      if (vertexMap.has(key)) return vertexMap.get(key)!;

      const index = vertices.length / 3;
      vertices.push(v.x * radius, v.y * radius, v.z * radius);
      vertexMap.set(key, index);
      return index;
    }

    const baseSub = Math.max(1, Math.min(minDetail || 1, 5));

    for (const faceIndices of ICOSAHEDRON_FACES) {
      const A = ICOSAHEDRON_VERTICES[faceIndices[0]];
      const B = ICOSAHEDRON_VERTICES[faceIndices[1]];
      const C = ICOSAHEDRON_VERTICES[faceIndices[2]];

      for (let i = 0; i < baseSub; i++) {
        for (let j = 0; j <= i; j++) {
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

            const k_f = getK(center);
            const k_e1 = getK(m12);
            const k_e2 = getK(m13);
            const k_e3 = getK(m23);

            const k = Math.max(k_f, k_e1, k_e2, k_e3);

            const faceGrid: number[][] = [];
            for (let r = 0; r <= k; r++) {
              faceGrid[r] = [];
              const t_r = r / k;
              const rowStart = slerp(v1, v2, t_r);
              const rowEnd = slerp(v1, v3, t_r);

              for (let c = 0; c <= r; c++) {
                let v: THREE.Vector3;

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

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(vertices), 3),
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [radius, minDetail, maxDetail, steps, stepGamma, color]);

  return (
    <group position={position}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} flatShading />
      </mesh>
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
