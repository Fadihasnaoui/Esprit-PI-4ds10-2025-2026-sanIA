import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 5000;

export default function WheatField() {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const geo = useMemo(
    () => new THREE.CylinderGeometry(0.008, 0.015, 1, 4),
    []
  );
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8B7D2A',
        roughness: 0.8,
        metalness: 0.05,
      }),
    []
  );

  const instanceData = useMemo(() => {
    const data = [];
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 34;
      data.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        rotY: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        scaleY: 0.6 + Math.random() * 0.7,
      });
    }
    return data;
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    instanceData.forEach((d, i) => {
      dummy.position.set(d.x, 0.5 * d.scaleY, d.z);
      dummy.rotation.set(
        0,
        d.rotY,
        Math.sin(t * 1.4 + d.phase + d.x * 0.3) * 0.12
      );
      dummy.scale.set(1, d.scaleY, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, COUNT]}
      castShadow
      frustumCulled={false}
    />
  );
}
