import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 250;

export default function SensorNetwork() {
  const pointsRef = useRef(null);
  const matRef = useRef(null);

  const geometry = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const baseY = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = 3 + Math.random() * 7;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      baseY[i] = pos[i * 3 + 1];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.userData.baseY = baseY;
    return geo;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = pointsRef.current;
    const mat = matRef.current;
    if (!p || !mat) return;

    mat.size = 0.18 + Math.sin(t * 2) * 0.05;
    const geo = p.geometry;
    const baseY = geo.userData.baseY;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3 + 1] = baseY[i] + Math.sin(t * 1.8 + i * 0.4) * 0.5;
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        ref={matRef}
        color="#a8c9bb"
        size={0.22}
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
