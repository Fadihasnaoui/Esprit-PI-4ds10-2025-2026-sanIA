import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, Stars } from '@react-three/drei';
import * as THREE from 'three';

const darkPalette = {
  background: '#07100C',
  fog: '#0B1A12',
  soil: '#26351E',
  field: '#34582D',
  crop: '#9DDD55',
  cropDark: '#6EA63C',
  tree: '#80C149',
  trunk: '#6D4931',
  water: '#5DC8EE',
  glass: '#BEE8F6',
  light: '#F5F1EB',
  scan: '#B6F66A',
};

const lightPalette = {
  background: '#7D8E73',
  fog: '#667760',
  soil: '#6B4D32',
  field: '#3F6834',
  crop: '#4C8E35',
  cropDark: '#244F24',
  tree: '#366625',
  trunk: '#5D3B25',
  water: '#145E78',
  glass: '#5F909C',
  light: '#F0E3C5',
  scan: '#7FCB3A',
};

const usePalette = (theme) => (theme === 'light' ? lightPalette : darkPalette);

const Terrain = ({ palette }) => {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(10.5, 6.2, 70, 46);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const wave = Math.sin(x * 1.35) * 0.08 + Math.cos(y * 1.7) * 0.06;
      pos.setZ(i, wave);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color={palette.soil} roughness={0.82} metalness={0.02} />
    </mesh>
  );
};

const CropRows = ({ palette, position, rows = 8, colorOffset = 0 }) => {
  const groupRef = useRef();
  const stems = useMemo(() => (
    Array.from({ length: rows * 10 }).map((_, index) => ({
      x: -1.55 + (index % 10) * 0.34,
      z: -0.65 + Math.floor(index / 10) * 0.18,
      scale: 0.78 + ((index + colorOffset) % 5) * 0.08,
    }))
  ), [rows, colorOffset]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 + colorOffset) * 0.012;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, -0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <boxGeometry args={[3.55, 1.72, 0.045]} />
        <meshStandardMaterial color={palette.field} roughness={0.72} />
      </mesh>
      {stems.map((stem, index) => (
        <mesh key={index} position={[stem.x, 0.035 * stem.scale, stem.z]} castShadow>
          <coneGeometry args={[0.035 * stem.scale, 0.18 * stem.scale, 5]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? palette.cropDark : palette.crop}
            roughness={0.55}
            emissive={palette.crop}
            emissiveIntensity={0.03}
          />
        </mesh>
      ))}
    </group>
  );
};

const Orchard = ({ palette, position }) => {
  const trees = useMemo(() => (
    Array.from({ length: 12 }).map((_, index) => ({
      x: -1.45 + (index % 4) * 0.78,
      z: -0.45 + Math.floor(index / 4) * 0.45,
      scale: 0.82 + (index % 4) * 0.07,
    }))
  ), []);

  return (
    <group position={position}>
      {trees.map((tree, index) => (
        <group key={index} position={[tree.x, 0, tree.z]} scale={tree.scale}>
          <mesh position={[0, 0.13, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.04, 0.28, 8]} />
            <meshStandardMaterial color={palette.trunk} roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.34, 0]} castShadow>
            <sphereGeometry args={[0.16, 16, 14]} />
            <meshStandardMaterial color={palette.tree} roughness={0.62} emissive={palette.crop} emissiveIntensity={0.04} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const Greenhouse = ({ palette, position }) => (
  <group position={position}>
    <mesh position={[0, 0.17, 0]} castShadow>
      <boxGeometry args={[1.25, 0.32, 0.82]} />
      <meshPhysicalMaterial
        color={palette.glass}
        transparent
        opacity={0.28}
        roughness={0.18}
        metalness={0}
        transmission={0.35}
        thickness={0.15}
      />
    </mesh>
    <mesh position={[0, 0.39, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
      <boxGeometry args={[0.88, 0.06, 0.88]} />
      <meshStandardMaterial color={palette.glass} transparent opacity={0.36} roughness={0.25} />
    </mesh>
    {[-0.45, 0, 0.45].map((x) => (
      <mesh key={x} position={[x, 0.34, 0]}>
        <boxGeometry args={[0.035, 0.48, 0.9]} />
        <meshStandardMaterial color={palette.light} roughness={0.45} />
      </mesh>
    ))}
  </group>
);

const Canal = ({ palette }) => {
  const points = useMemo(() => [
    new THREE.Vector3(-4.3, 0.035, 1.2),
    new THREE.Vector3(-2.3, 0.04, 0.72),
    new THREE.Vector3(-0.7, 0.04, 0.98),
    new THREE.Vector3(1.35, 0.04, 0.46),
    new THREE.Vector3(4.35, 0.035, 0.78),
  ], []);

  return (
    <>
      <Line points={points} color={palette.water} lineWidth={7} transparent opacity={0.36} />
      <Line points={points} color={palette.light} lineWidth={1.15} transparent opacity={0.3} />
    </>
  );
};

const SensorTower = ({ palette, position, delay = 0 }) => {
  const pulseRef = useRef();

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const t = clock.elapsedTime + delay;
    const pulse = 1 + Math.max(0, Math.sin(t * 2.8)) * 0.55;
    pulseRef.current.scale.setScalar(pulse);
    pulseRef.current.material.opacity = 0.16 + Math.max(0, Math.sin(t * 2.8)) * 0.28;
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.042, 0.72, 10]} />
        <meshStandardMaterial color={palette.light} roughness={0.34} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.065, 18, 18]} />
        <meshStandardMaterial color={palette.scan} emissive={palette.scan} emissiveIntensity={1.3} roughness={0.25} />
      </mesh>
      <mesh ref={pulseRef} position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.17, 24, 24]} />
        <meshBasicMaterial color={palette.scan} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

const Drone = ({ palette }) => {
  const droneRef = useRef();
  const rotorRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.52;
    if (droneRef.current) {
      droneRef.current.position.set(Math.cos(t) * 2.25, 1.72 + Math.sin(t * 1.8) * 0.16, Math.sin(t) * 1.05 - 0.25);
      droneRef.current.rotation.y = -t + Math.PI / 2;
      droneRef.current.rotation.z = Math.sin(t * 2) * 0.08;
    }
    if (rotorRef.current) rotorRef.current.rotation.y = clock.elapsedTime * 18;
  });

  return (
    <group ref={droneRef}>
      <mesh castShadow>
        <boxGeometry args={[0.24, 0.08, 0.18]} />
        <meshStandardMaterial color={palette.light} roughness={0.28} metalness={0.32} />
      </mesh>
      {[[-0.28, 0, -0.2], [0.28, 0, -0.2], [-0.28, 0, 0.2], [0.28, 0, 0.2]].map((p, index) => (
        <group key={index} position={p}>
          <mesh rotation={[0, 0, index % 2 ? 0.4 : -0.4]}>
            <boxGeometry args={[0.32, 0.012, 0.035]} />
            <meshStandardMaterial color={palette.light} roughness={0.25} metalness={0.22} />
          </mesh>
          <mesh ref={index === 0 ? rotorRef : undefined} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.095, 0.105, 18]} />
            <meshBasicMaterial color={palette.water} transparent opacity={0.45} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.42, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.5, 0.82, 34, 1, true]} />
        <meshBasicMaterial color={palette.water} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const ScanningSweep = ({ palette }) => {
  const scanRef = useRef();

  useFrame(({ clock }) => {
    if (!scanRef.current) return;
    scanRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.7) * 0.62;
    scanRef.current.material.opacity = 0.12 + Math.sin(clock.elapsedTime * 2.2) * 0.035;
  });

  return (
    <mesh ref={scanRef} position={[0.15, 0.86, -0.25]} rotation={[Math.PI / 2.15, 0, 0]}>
      <coneGeometry args={[2.7, 2.15, 56, 1, true]} />
      <meshBasicMaterial color={palette.scan} transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
};

const DataArc = ({ palette, from, to, color }) => {
  const points = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 0.75;
    return new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(28);
  }, [from, to]);

  return <Line points={points} color={color || palette.scan} lineWidth={1.15} transparent opacity={0.38} />;
};

const FarmCore = ({ stats, theme }) => {
  const rootRef = useRef();
  const palette = usePalette(theme);
  const alertIntensity = Math.min(1, (stats?.alerts || 0) / 4);

  useFrame(({ clock, mouse }) => {
    if (!rootRef.current) return;
    rootRef.current.rotation.x = -0.42 + mouse.y * 0.045;
    rootRef.current.rotation.y = -0.08 + mouse.x * 0.08 + Math.sin(clock.elapsedTime * 0.12) * 0.025;
  });

  return (
    <group ref={rootRef} position={[0, -0.92, 0.16]} rotation={[-0.42, -0.08, 0]}>
      <Terrain palette={palette} />
      <Canal palette={palette} />
      <CropRows palette={palette} position={[-2.45, 0.05, -0.95]} colorOffset={1} />
      <CropRows palette={palette} position={[1.85, 0.05, -1.08]} rows={7} colorOffset={4} />
      <Orchard palette={palette} position={[-1.8, 0.05, 1.18]} />
      <Greenhouse palette={palette} position={[2.3, 0.08, 1.2]} />
      <SensorTower palette={palette} position={[-3.7, 0.05, -1.55]} delay={0.2} />
      <SensorTower palette={palette} position={[0.1, 0.05, 1.42]} delay={0.8} />
      <SensorTower palette={palette} position={[3.55, 0.05, -1.3]} delay={1.4} />
      <DataArc palette={palette} from={[-3.7, 0.85, -1.55]} to={[0, 2.1, -0.2]} color={palette.crop} />
      <DataArc palette={palette} from={[0.1, 0.85, 1.42]} to={[0, 2.1, -0.2]} color={palette.water} />
      <DataArc palette={palette} from={[3.55, 0.85, -1.3]} to={[0, 2.1, -0.2]} color={alertIntensity > 0 ? '#F97316' : palette.scan} />
      <ScanningSweep palette={palette} />
      <Drone palette={palette} />
    </group>
  );
};

const SaniaFarmScene = ({ stats, theme = 'dark' }) => {
  const palette = usePalette(theme);
  const isLight = theme === 'light';

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas
        shadows
        camera={{ position: [0, 2.55, 5.35], fov: 42 }}
        dpr={[1, 1.55]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[palette.background]} />
        <fog attach="fog" args={[palette.fog, isLight ? 8.2 : 6.4, isLight ? 14.5 : 12.4]} />
        <ambientLight intensity={isLight ? 0.62 : 1.02} />
        <directionalLight
          castShadow
          position={[3.5, 5.2, 3.6]}
          intensity={isLight ? 1.05 : 1.82}
          color={palette.light}
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-3, 2.3, 2.4]} intensity={isLight ? 1.35 : 4.2} color={palette.crop} />
        <pointLight position={[3.2, 2.2, -1.7]} intensity={isLight ? 1.15 : 3.35} color={palette.water} />
        {!isLight && <Stars radius={46} depth={18} count={760} factor={2.2} saturation={0.28} fade speed={0.28} />}
        <Float speed={0.75} floatIntensity={0.12} rotationIntensity={0.04}>
          <FarmCore stats={stats} theme={theme} />
        </Float>
      </Canvas>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: isLight
          ? [
            'radial-gradient(circle at 50% 34%, rgba(245,248,241,0.1) 0%, rgba(48,66,44,0.12) 54%, rgba(16,28,18,0.26) 100%)',
            'linear-gradient(180deg, rgba(25,38,27,0.08) 0%, rgba(25,38,27,0.0) 42%, rgba(25,38,27,0.22) 100%)',
            'linear-gradient(90deg, rgba(9,20,13,0.24) 0%, transparent 19%, transparent 81%, rgba(9,20,13,0.24) 100%)',
          ].join(',')
          : [
            'radial-gradient(circle at 50% 42%, rgba(11,15,13,0.0), rgba(11,15,13,0.36) 58%, rgba(11,15,13,0.9) 100%)',
            'linear-gradient(180deg, rgba(11,15,13,0.16) 0%, rgba(11,15,13,0.0) 42%, rgba(11,15,13,0.76) 100%)',
          ].join(','),
      }} />
    </div>
  );
};

export default SaniaFarmScene;
