import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import SphericalClipmap from "../components/SphericalClipmap";

export default function Home() {
  return (
    <div className="h-screen w-full bg-black">
      <Canvas gl={{ antialias: true }}>
        <PerspectiveCamera
          makeDefault
          position={[0, 150, 200]}
          near={0.1}
          far={20000}
        />
        <OrbitControls target={[0, 0, 0]} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 50]} intensity={1} />

        <group position={[0, -50, 0]}>
          <SphericalClipmap />
        </group>

        <mesh position={[0, 0, 0]}>
           <cylinderGeometry args={[0.2, 0.2, 1, 16]} />
           <meshBasicMaterial color="lime" />
        </mesh>
      </Canvas>
    </div>
  );
}
