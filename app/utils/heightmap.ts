import * as THREE from 'three';

export interface HeightMapData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export async function loadHeightMap(
  url: string,
): Promise<HeightMapData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      resolve({
        data: imageData.data,
        width: img.width,
        height: img.height,
      });
    };
    img.onerror = () => resolve(null);
  });
}

export function sampleHeight(
  u: number,
  v: number,
  heightMap: HeightMapData,
): number {
  const x = Math.max(
    0,
    Math.min(heightMap.width - 1, Math.floor(u * (heightMap.width - 1))),
  );
  const y = Math.max(
    0,
    Math.min(heightMap.height - 1, Math.floor(v * (heightMap.height - 1))),
  );
  const index = (y * heightMap.width + x) * 4;
  // Assuming grayscale, use R channel
  return heightMap.data[index] / 255;
}

export function getCylindricalUV(v: THREE.Vector3) {
  // lon: -pi to pi, lat: -pi/2 to pi/2
  const lon = Math.atan2(v.x, v.z);
  const lat = Math.asin(Math.max(-1, Math.min(1, v.y)));

  // u: 0 at -pi, 0.5 at 0, 1 at pi
  const u = (lon + Math.PI) / (2 * Math.PI);

  // v: 0 at North Pole (lat = pi/2), 1 at South Pole (lat = -pi/2)
  // lat + pi/2 goes from 0 to pi.
  const v_coord = (lat + Math.PI / 2) / Math.PI;

  return { u, v: 1 - v_coord };
}
