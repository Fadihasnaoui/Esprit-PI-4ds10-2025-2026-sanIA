import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import FarmTerrain from './FarmTerrain';
import WheatField from './WheatField';
import SensorNetwork from './SensorNetwork';
import AIDrone from './AIDrone';
import HoloPanels from './HoloPanels';

export default function FarmCanvas() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        camera={{ fov: 58, position: [0, 16, 36], near: 0.1, far: 500 }}
      >
        <fogExp2 attach="fog" args={['#0a1510', 0.0045]} />

        <ambientLight intensity={0.3} color="#0a1628" />
        <directionalLight
          position={[30, 20, 10]}
          intensity={2.5}
          color="#FFB347"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[0, 15, 0]} intensity={0.85} color="#c8ddd2" />

        <Suspense fallback={null}>
          <FarmTerrain />
          <WheatField />
          <SensorNetwork />
          <AIDrone />
          <HoloPanels />
        </Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.2}
          minPolarAngle={0.3}
          maxPolarAngle={1.1}
        />
      </Canvas>
    </div>
  );
}
