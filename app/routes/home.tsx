import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { CubicSpheroid } from "~/components/CubicSpheroid";

export default function Home() {
  return (
    <div className="h-screen w-full bg-black">
      <Canvas gl={{ antialias: true }}>
        <PerspectiveCamera
          makeDefault
          position={[0, 10, 30]}
          near={0.1}
          far={10000}
        />
        <OrbitControls target={[0, 0, 0]} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 2, 16]} />
          <meshStandardMaterial color="red" />
        </mesh>

        <CubicSpheroid />
      </Canvas>
    </div>
  );
}
