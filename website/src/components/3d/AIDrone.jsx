import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box, Cylinder, Trail } from '@react-three/drei';
import * as THREE from 'three';

export default function AIDrone() {
  const { scene } = useThree();
  const groupRef = useRef(null);
  const r1 = useRef(null);
  const r2 = useRef(null);
  const r3 = useRef(null);
  const r4 = useRef(null);
  const spotRef = useRef(null);
  const tRef = useRef(0);

  useEffect(() => {
    const light = spotRef.current;
    if (light?.target) {
      scene.add(light.target);
      return () => {
        scene.remove(light.target);
      };
    }
    return undefined;
  }, [scene]);

  const curve = useMemo(() => {
    const pts = [
      new THREE.Vector3(-22, 14, -18),
      new THREE.Vector3(0, 16, -28),
      new THREE.Vector3(22, 15, -12),
      new THREE.Vector3(18, 13, 12),
      new THREE.Vector3(0, 15, 22),
      new THREE.Vector3(-20, 14, 15),
      new THREE.Vector3(-25, 12, 0),
      new THREE.Vector3(-15, 13, -22),
    ];
    return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.6);
  }, []);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    tRef.current = (tRef.current + delta * 0.04) % 1;
    const t = tRef.current;
    const pos = curve.getPoint(t);
    const look = curve.getPointAt((t + 0.002) % 1);
    g.position.copy(pos);
    g.lookAt(look);

    const spin = delta * 25;
    if (r1.current) r1.current.rotation.y += spin;
    if (r2.current) r2.current.rotation.y -= spin;
    if (r3.current) r3.current.rotation.y += spin;
    if (r4.current) r4.current.rotation.y -= spin;

    if (spotRef.current?.target) {
      spotRef.current.target.position.set(pos.x, 0, pos.z);
      spotRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <Trail
      width={0.45}
      length={22}
      color="#9bc4b3"
      attenuation={(x) => x * x}
    >
      <group ref={groupRef}>
        <spotLight
          ref={spotRef}
          color="#b8d4c8"
          intensity={6}
          angle={0.28}
          penumbra={0.5}
          position={[0, -1.2, 0]}
          castShadow
        />

        <Box args={[0.9, 0.22, 0.9]} castShadow>
          <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.4} />
        </Box>

        <group rotation={[0, Math.PI / 4, 0]}>
          <Box args={[0.9, 0.05, 0.08]} position={[0, 0.2, 0]} castShadow>
            <meshStandardMaterial color="#2a2a44" />
          </Box>
        </group>
        <group rotation={[0, -Math.PI / 4, 0]}>
          <Box args={[0.9, 0.05, 0.08]} position={[0, 0.2, 0]} castShadow>
            <meshStandardMaterial color="#2a2a44" />
          </Box>
        </group>

        <group position={[0.55, 0.35, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <Cylinder ref={r1} args={[0.38, 0.38, 0.04, 16]} castShadow>
            <meshStandardMaterial color="#333" />
          </Cylinder>
        </group>
        <group position={[-0.55, 0.35, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <Cylinder ref={r2} args={[0.38, 0.38, 0.04, 16]} castShadow>
            <meshStandardMaterial color="#333" />
          </Cylinder>
        </group>
        <group position={[0.55, 0.35, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <Cylinder ref={r3} args={[0.38, 0.38, 0.04, 16]} castShadow>
            <meshStandardMaterial color="#333" />
          </Cylinder>
        </group>
        <group position={[-0.55, 0.35, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <Cylinder ref={r4} args={[0.38, 0.38, 0.04, 16]} castShadow>
            <meshStandardMaterial color="#333" />
          </Cylinder>
        </group>
      </group>
    </Trail>
  );
}
