import { useRef, useState, useMemo, useEffect } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface DraggableCapsuleProps {
  planetPosition: [number, number, number];
  planetRadius: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onPositionChange?: (position: THREE.Vector3) => void;
}

export default function DraggableCapsule({
  planetPosition,
  planetRadius,
  onDragStart,
  onDragEnd,
  onPositionChange,
}: DraggableCapsuleProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster } = useThree();
  const [isDragging, setIsDragging] = useState(false);

  // The distance from the planet center to the capsule center
  // Capsule height = length + 2 * radius = 1 + 2 * 0.2 = 1.4
  // Half height = 0.7
  const orbitRadius = planetRadius + 0.7;
  const planetCenter = useMemo(
    () => new THREE.Vector3(...planetPosition),
    [planetPosition],
  );

  // Maintain the direction from center to stay consistent when radius changes
  const direction = useRef(new THREE.Vector3(0, 1, 0));

  useEffect(() => {
    if (meshRef.current && !isDragging) {
      const newPos = planetCenter
        .clone()
        .add(direction.current.clone().multiplyScalar(orbitRadius));
      meshRef.current.position.copy(newPos);
      meshRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.current,
      );
      onPositionChange?.(newPos);
    }
  }, [planetCenter, orbitRadius, isDragging, onPositionChange]);

  // Handle dragging logic
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(true);
    onDragStart?.();

    // Set pointer capture to handle movement outside the mesh
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    setIsDragging(false);
    onDragEnd?.();
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isDragging && meshRef.current) {
      // Raycast to find the point on the "orbit sphere"
      raycaster.setFromCamera(e.pointer, camera);

      const orbitSphere = new THREE.Sphere(planetCenter, orbitRadius);
      const intersection = new THREE.Vector3();

      if (raycaster.ray.intersectSphere(orbitSphere, intersection)) {
        meshRef.current.position.copy(intersection);

        // Update stored direction
        direction.current
          .copy(intersection)
          .sub(planetCenter)
          .normalize();

        // Make the capsule point away from the center (aligned with surface normal)
        meshRef.current.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.current,
        );

        onPositionChange?.(intersection.clone());
      }
    }
  };

  return (
    <mesh
      ref={meshRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerOver={() => (document.body.style.cursor = 'grab')}
      onPointerOut={() => !isDragging && (document.body.style.cursor = 'auto')}
    >
      <capsuleGeometry args={[0.2, 1, 4, 16]} />
      <meshStandardMaterial color={isDragging ? 'yellow' : 'lime'} />
    </mesh>
  );
}
