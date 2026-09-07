'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Máquina de afeitar (clipper) estilizada, construida con primitivas de
 * three.js — sin archivos `.glb`, así el bundle queda liviano y el modelo
 * es 100% parametrizable desde código.
 */

const TEETH_COUNT = 13;
const BODY_COLOR = '#1F2430';
const CHROME_COLOR = '#E8ECF2';
const BRAND_COLOR = '#0066FF';

/** Escala base del modelo y factor extra cuando el viewport es angosto. */
const BASE_SCALE = 0.82;
const COMPACT_QUERY = '(max-width: 749px)';
const COMPACT_SCALE_BOOST = 1.2;

/** `true` cuando la home está por debajo de 750px de ancho. */
function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(COMPACT_QUERY);
    const sync = () => setCompact(mql.matches);

    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  return compact;
}

function Teeth() {
  /** Posiciones X de los dientes de la cuchilla, centradas en 0. */
  const positions = useMemo<number[]>(() => {
    const spacing = 1.08 / (TEETH_COUNT - 1);
    return Array.from(
      { length: TEETH_COUNT },
      (_, index) => -0.54 + index * spacing,
    );
  }, []);

  return (
    <group position={[0, 1.72, 0.06]}>
      {positions.map((x) => (
        <mesh key={x} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[0.042, 0.16, 0.34]} />
          <meshStandardMaterial
            color={CHROME_COLOR}
            metalness={1}
            roughness={0.08}
          />
        </mesh>
      ))}
    </group>
  );
}

export function ClipperModel() {
  const groupRef = useRef<THREE.Group>(null);
  const compact = useCompactViewport();
  const scale = compact ? BASE_SCALE * COMPACT_SCALE_BOOST : BASE_SCALE;

  /**
   * Giro continuo y constante en el eje Y (nunca se detiene ni invierte, por
   * eso usamos `delta` en lugar de un `Math.sin` que frena en los extremos) +
   * micro-oscilación suave en X para darle vida sin cortar el movimiento.
   */
  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const time = state.clock.getElapsedTime();
    group.rotation.y += delta * 0.45;
    group.rotation.x = Math.sin(time * 0.5) * 0.06;
  });

  return (
    <group ref={groupRef} rotation={[0.1, -0.35, 0.22]} scale={scale} position={[0, 0.55, 0]}>
      {/* Cuerpo principal */}
      <RoundedBox args={[1.12, 2.7, 0.72]} radius={0.2} smoothness={6} castShadow>
        <meshStandardMaterial
          color={BODY_COLOR}
          metalness={0.95}
          roughness={0.22}
        />
      </RoundedBox>

      {/* Placa frontal cepillada */}
      <RoundedBox
        args={[0.74, 1.85, 0.06]}
        radius={0.03}
        smoothness={4}
        position={[0, 0.05, 0.37]}
      >
        <meshStandardMaterial
          color="#9AA4B2"
          metalness={1}
          roughness={0.16}
        />
      </RoundedBox>

      {/* Franja de marca (azul eléctrico) */}
      <RoundedBox
        args={[0.74, 0.1, 0.08]}
        radius={0.03}
        smoothness={4}
        position={[0, -0.62, 0.38]}
      >
        <meshStandardMaterial
          color={BRAND_COLOR}
          emissive={BRAND_COLOR}
          emissiveIntensity={0.55}
          metalness={0.4}
          roughness={0.3}
        />
      </RoundedBox>

      {/* Interruptor deslizante */}
      <RoundedBox
        args={[0.34, 0.22, 0.1]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.72, 0.4]}
      >
        <meshStandardMaterial
          color={CHROME_COLOR}
          metalness={1}
          roughness={0.1}
        />
      </RoundedBox>

      {/* Cuello cromado entre cuerpo y cabezal */}
      <RoundedBox
        args={[1.02, 0.22, 0.66]}
        radius={0.08}
        smoothness={4}
        position={[0, 1.42, 0]}
        castShadow
      >
        <meshStandardMaterial
          color={CHROME_COLOR}
          metalness={1}
          roughness={0.12}
        />
      </RoundedBox>

      {/* Cabezal / soporte de la cuchilla */}
      <RoundedBox
        args={[1.2, 0.24, 0.6]}
        radius={0.06}
        smoothness={4}
        position={[0, 1.6, -0.02]}
        castShadow
      >
        <meshStandardMaterial
          color="#6B7280"
          metalness={1}
          roughness={0.18}
        />
      </RoundedBox>

      <Teeth />

      {/* Ranuras de ventilación laterales */}
      {[-0.35, -0.15, 0.05].map((y) => (
        <mesh key={y} position={[0.57, y, 0]}>
          <boxGeometry args={[0.02, 0.05, 0.42]} />
          <meshStandardMaterial color="#0B1220" metalness={0.6} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}
