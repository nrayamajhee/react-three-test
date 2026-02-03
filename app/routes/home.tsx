import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useControls } from 'leva';
import Planet from '../components/Planet';

export default function Home() {
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
      value: 10,
      min: 0,
      max: 100,
      step: 1,
      label: 'Min Resolution',
    },
    maxResolution: {
      value: 50,
      min: 1,
      max: 100,
      step: 1,
      label: 'Max Resolution',
    },
    steps: { value: 5, min: 1, max: 10, step: 1, label: 'Steps' },
    stepGamma: {
      value: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: 'Step Gamma',
    },
    radius: { value: 100, min: 10, max: 100 },
    color: '#4169e1',
    wireframe: true,
  });

  return (
    <div className="h-screen w-full bg-black">
      <Canvas gl={{ antialias: true }}>
        <PerspectiveCamera
          makeDefault
          position={[0, 100, 150]}
          near={0.1}
          far={20000}
        />
        <OrbitControls target={[0, 0, 0]} />

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
          position={[0, -radius, 0]}
        />

        {/* Small marker at the center */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 1, 16]} />
          <meshBasicMaterial color="lime" />
        </mesh>
      </Canvas>
    </div>
  );
}
