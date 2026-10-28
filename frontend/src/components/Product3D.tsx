import { Float, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { prefersReducedMotion } from '../lib/format';

type Shape = 'sphere' | 'torus' | 'box' | 'cone' | 'knot' | 'capsule';

function Glb({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1.4} />;
}
function Mesh({ shape, color }: { shape: Shape; color: string }) {
  return (
    <mesh castShadow>
      {shape === 'sphere' && <sphereGeometry args={[1.1, 64, 64]} />}
      {shape === 'torus' && <torusGeometry args={[0.9, 0.38, 48, 120]} />}
      {shape === 'box' && <boxGeometry args={[1.5, 1.1, 1.1]} />}
      {shape === 'cone' && <coneGeometry args={[0.9, 1.8, 64]} />}
      {shape === 'knot' && <torusKnotGeometry args={[0.78, 0.26, 220, 32]} />}
      {shape === 'capsule' && <capsuleGeometry args={[0.55, 1.1, 16, 48]} />}
      <meshStandardMaterial color={color} metalness={0.65} roughness={0.28} />
    </mesh>
  );
}

/** Lazy-loaded (see React.lazy at call sites). No remote HDRI: it is lit with plain lights so it works offline. */
export default function Product3D({ shape = 'knot', color = '#b794f6', modelUrl, interactive = true, label }: { shape?: Shape; color?: string; modelUrl?: string; interactive?: boolean; label?: string }) {
  const still = prefersReducedMotion();
  return (
    <div role="img" aria-label={label ?? '3D preview. Drag to rotate.'} className="h-full w-full">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 4.4], fov: 40 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} />
        <pointLight position={[-4, -2, 2]} intensity={14} color="#b794f6" />
        <pointLight position={[3, -3, -2]} intensity={10} color="#f2b84b" />
        <Suspense fallback={null}>
          <Float speed={still ? 0 : 1.6} rotationIntensity={still ? 0 : 0.5} floatIntensity={still ? 0 : 0.8}>
            {modelUrl ? <Glb url={modelUrl} /> : <Mesh shape={shape} color={color} />}
          </Float>
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} enabled={interactive} autoRotate={!still} autoRotateSpeed={1.2} />
      </Canvas>
    </div>
  );
}
