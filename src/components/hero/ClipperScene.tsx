'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Float, Lightformer } from '@react-three/drei';
import * as THREE from 'three';

import { ClipperModel } from './ClipperModel';

/**
 * Escena 3D del hero.
 *
 * - `ParallaxRig` inclina el grupo siguiendo el cursor (mouse parallax).
 * - `Float` agrega el flotado suave.
 * - `Environment` se arma con `Lightformer` (estudio procedural): no descarga
 *   ningún HDRI, así que la escena funciona también sin conexión.
 */

function ParallaxRig({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const target = useRef(new THREE.Vector2(0, 0));

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    // `state.pointer` va de -1 a 1 en ambos ejes.
    target.current.set(state.pointer.x, state.pointer.y);

    const damping = 1 - Math.pow(0.001, delta);
    group.rotation.y = THREE.MathUtils.lerp(
      group.rotation.y,
      target.current.x * 0.45,
      damping,
    );
    group.rotation.x = THREE.MathUtils.lerp(
      group.rotation.x,
      -target.current.y * 0.3,
      damping,
    );
    group.position.x = THREE.MathUtils.lerp(
      group.position.x,
      (target.current.x * viewport.width) / 28,
      damping,
    );
  });

  return <group ref={groupRef}>{children}</group>;
}

export default function ClipperScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 7.6], fov: 34 }}
      aria-hidden="true"
    >
      <color attach="background" args={['#F9FAFB']} />
      <fog attach="fog" args={['#F9FAFB', 9, 18]} />

      <ambientLight intensity={0.55} />
      <directionalLight
        position={[4, 6, 5]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 2, -4]} intensity={1.1} color="#0066FF" />
      <spotLight
        position={[0, 6, 3]}
        angle={0.5}
        penumbra={1}
        intensity={2.2}
        color="#FFFFFF"
      />

      <Suspense fallback={null}>
        <ParallaxRig>
          <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.9}>
            <ClipperModel />
          </Float>
        </ParallaxRig>

        <ContactShadows
          position={[0, -2.6, 0]}
          opacity={0.35}
          scale={11}
          blur={2.8}
          far={5}
          color="#111827"
        />

        {/* Estudio procedural: reflejos metálicos sin assets externos. */}
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={4}
            position={[0, 4, 2]}
            scale={[8, 3, 1]}
            color="#FFFFFF"
          />
          <Lightformer
            form="rect"
            intensity={3}
            position={[-4, 1, 2]}
            rotation={[0, Math.PI / 3, 0]}
            scale={[4, 6, 1]}
            color="#DDE5F0"
          />
          <Lightformer
            form="rect"
            intensity={2.4}
            position={[4, 0, -2]}
            rotation={[0, -Math.PI / 3, 0]}
            scale={[4, 6, 1]}
            color="#0066FF"
          />
          <Lightformer
            form="circle"
            intensity={2}
            position={[0, -3, 1]}
            scale={5}
            color="#FFFFFF"
          />
        </Environment>
      </Suspense>
    </Canvas>
  );
}
