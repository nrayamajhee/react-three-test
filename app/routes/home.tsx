import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';
import Planet from '../components/Planet';
import DraggableCapsule from '../components/DraggableCapsule';

export default function Home() {
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const [capsulePosition, setCapsulePosition] = useState<THREE.Vector3>(
    new THREE.Vector3(0, 10.7, 0),
  );

  const {
    minResolution,
    maxResolution,
    steps,
    stepGamma,
    radius,
    color,
    wireframe,
  } = useControls({
    minResolution: {
      value: 4,
      min: 0,
      max: 100,
      step: 1,
      label: 'Min Resolution',
    },
    maxResolution: {
      value: 12,
      min: 1,
      max: 100,
      step: 1,
      label: 'Max Resolution',
    },
    steps: { value: 4, min: 1, max: 10, step: 1, label: 'Steps' },
    stepGamma: {
      value: 2.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: 'Step Gamma',
    },
    radius: { value: 10, min: 1, max: 10 },
    color: '#4169e1',
    wireframe: true,
  });

  return (
    <div className="h-screen w-full bg-black">
      <Canvas gl={{ antialias: true }}>
        <PerspectiveCamera
          makeDefault
          position={[0, 20, 20]}
          near={0.01}
          far={1000}
        />
        <OrbitControls target={[0, 0, 0]} enabled={controlsEnabled} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 50]} intensity={1.5} />

        <Planet
          minDetail={minResolution}
          maxDetail={maxResolution}
          steps={steps}
          stepGamma={stepGamma}
          radius={radius}
          color={color}
          wireframe={wireframe}
          position={[0, 0, 0]}
          targetPosition={capsulePosition}
        />

        <DraggableCapsule
          planetPosition={[0, 0, 0]}
          planetRadius={radius}
          onDragStart={() => setControlsEnabled(false)}
          onDragEnd={() => setControlsEnabled(true)}
          onPositionChange={setCapsulePosition}
        />
      </Canvas>
    </div>
  );
}
