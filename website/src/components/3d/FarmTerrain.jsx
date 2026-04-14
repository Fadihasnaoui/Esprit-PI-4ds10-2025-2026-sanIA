import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
uniform float uTime;
varying float vHeight;
varying vec2 vUv;

float noise(vec2 p) {
  return sin(p.x * 1.3 + uTime * 0.3) * cos(p.y * 1.1) * 0.5
       + sin(p.x * 2.7) * sin(p.y * 2.3 + uTime * 0.2) * 0.25
       + sin(p.x * 5.1 + p.y * 4.9) * 0.125;
}

void main() {
  vec3 pos = position;
  float h = noise(pos.xz * 0.15) * 2.2
          + noise(pos.xz * 0.4) * 0.6
          + noise(pos.xz * 1.2) * 0.15;
  pos.y += h;
  vHeight = h;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = `
varying float vHeight;
varying vec2 vUv;
uniform float uTime;

void main() {
  float t = clamp((vHeight + 1.0) / 3.0, 0.0, 1.0);
  vec3 soilColor  = vec3(0.05, 0.12, 0.06);
  vec3 grassColor = vec3(0.10, 0.24, 0.12);
  vec3 ridgeColor = vec3(0.18, 0.42, 0.21);
  vec3 col = mix(soilColor, grassColor, smoothstep(0.0, 0.5, t));
  col = mix(col, ridgeColor, smoothstep(0.5, 1.0, t));

  vec2 grid = abs(fract(vUv * 40.0) - 0.5);
  float line = min(grid.x, grid.y);
  col += (1.0 - smoothstep(0.0, 0.04, line)) * 0.022 * vec3(0.62, 0.76, 0.68);

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function FarmTerrain() {
  const meshRef = useRef(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80, 200, 200]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
