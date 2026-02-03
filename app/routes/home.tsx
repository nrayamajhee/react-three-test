import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import GeometryClipmap from "../components/GeometryClipmap";

export default function Home() {
  return (
    <div className="h-screen w-full bg-black">
      <Canvas gl={{ antialias: true }}>
        <PerspectiveCamera
          makeDefault
          position={[0, 50, 100]}
          near={0.1}
          far={20000}
        />
        <OrbitControls target={[0, 0, 0]} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 50]} intensity={1} />

        <GeometryClipmap levels={6} segments={64} color="#8B4513" wireframeColor="#DEB887" />
      </Canvas>
    </div>
  );
}
