'use client';

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Environment, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Three.js AI Twin Avatar Component
 * Renders a futuristic AI proctor avatar with animated expressions.
 * Uses particle systems, glow effects, and distortion materials.
 */

interface AIAvatarProps {
  mood: 'neutral' | 'alert' | 'warning' | 'critical';
  speaking: boolean;
  message?: string;
  trustScore: number;
}

// ── Animated Core Sphere ──
function CoreSphere({ mood, speaking }: { mood: string; speaking: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  const moodColors: Record<string, string> = {
    neutral: '#6366f1',
    alert: '#f59e0b',
    warning: '#ef4444',
    critical: '#dc2626',
  };

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    // Breathing animation
    const breathScale = 1 + Math.sin(t * 2) * 0.05;
    meshRef.current.scale.setScalar(breathScale);

    // Speaking pulse
    if (speaking) {
      const speakPulse = 1 + Math.sin(t * 8) * 0.08;
      meshRef.current.scale.y = breathScale * speakPulse;
    }

    // Update distortion based on mood
    if (materialRef.current) {
      const targetDistort = mood === 'critical' ? 0.6 : mood === 'warning' ? 0.4 : mood === 'alert' ? 0.25 : 0.15;
      materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, targetDistort, 0.02);
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <Sphere ref={meshRef} args={[1, 64, 64]}>
        <MeshDistortMaterial
          ref={materialRef}
          color={moodColors[mood]}
          emissive={moodColors[mood]}
          emissiveIntensity={0.4}
          roughness={0.1}
          metalness={0.8}
          distort={0.15}
          speed={3}
          transparent
          opacity={0.9}
        />
      </Sphere>
    </Float>
  );
}

// ── Orbital Rings ──
function OrbitalRings({ mood }: { mood: string }) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  const speedMultiplier = mood === 'critical' ? 3 : mood === 'warning' ? 2 : 1;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = t * 0.5 * speedMultiplier;
      ring1Ref.current.rotation.z = t * 0.3;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = t * 0.4 * speedMultiplier;
      ring2Ref.current.rotation.x = Math.PI / 3;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = -t * 0.6 * speedMultiplier;
      ring3Ref.current.rotation.y = Math.PI / 4;
    }
  });

  const ringColor = mood === 'critical' ? '#ef4444' : mood === 'warning' ? '#f59e0b' : '#818cf8';

  return (
    <>
      <mesh ref={ring1Ref}>
        <torusGeometry args={[1.5, 0.02, 16, 100]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.8} transparent opacity={0.6} />
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[1.7, 0.015, 16, 100]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.5} transparent opacity={0.4} />
      </mesh>
      <mesh ref={ring3Ref}>
        <torusGeometry args={[1.9, 0.01, 16, 100]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.3} transparent opacity={0.3} />
      </mesh>
    </>
  );
}

// ── Glowing Eyes ──
function Eyes({ mood, speaking }: { mood: string; speaking: boolean }) {
  const leftRef = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Slow eye tracking (simulating gaze)
    const lookX = Math.sin(t * 0.5) * 0.05;
    const lookY = Math.cos(t * 0.3) * 0.03;

    if (leftRef.current) {
      leftRef.current.position.x = -0.3 + lookX;
      leftRef.current.position.y = 0.2 + lookY;
    }
    if (rightRef.current) {
      rightRef.current.position.x = 0.3 + lookX;
      rightRef.current.position.y = 0.2 + lookY;
    }

    // Blink every ~4 seconds
    const blink = Math.sin(t * 0.8) > 0.95;
    const scaleY = blink ? 0.1 : 1;
    if (leftRef.current) leftRef.current.scale.y = scaleY;
    if (rightRef.current) rightRef.current.scale.y = scaleY;
  });

  const eyeColor = mood === 'critical' ? '#ff0000' : mood === 'warning' ? '#fbbf24' : '#a5b4fc';

  return (
    <>
      <mesh ref={leftRef} position={[-0.3, 0.2, 0.85]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={2} />
      </mesh>
      <mesh ref={rightRef} position={[0.3, 0.2, 0.85]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={2} />
      </mesh>
    </>
  );
}

// ── Particle System ──
function Particles({ count = 50, mood }: { count?: number; mood: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(count * 3));

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      positionsRef.current[i * 3] = (Math.random() - 0.5) * 6;
      positionsRef.current[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positionsRef.current[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      const x = positionsRef.current[i * 3];
      const y = positionsRef.current[i * 3 + 1];
      const z = positionsRef.current[i * 3 + 2];

      const angle = t * 0.3 + i * 0.1;
      const radius = Math.sqrt(x * x + z * z);

      matrix.setPosition(
        Math.cos(angle) * radius,
        y + Math.sin(t + i) * 0.3,
        Math.sin(angle) * radius
      );

      const scale = 0.02 + Math.sin(t * 2 + i) * 0.01;
      matrix.scale(new THREE.Vector3(scale, scale, scale));

      meshRef.current.setMatrixAt(i, matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const particleColor = mood === 'critical' ? '#ef4444' : mood === 'warning' ? '#f59e0b' : '#818cf8';

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color={particleColor} emissive={particleColor} emissiveIntensity={1} transparent opacity={0.6} />
    </instancedMesh>
  );
}

// ── Trust Score Arc ──
function TrustArc({ score }: { score: number }) {
  const arcRef = useRef<THREE.Line>(null);

  useFrame(() => {
    if (!arcRef.current) return;
    arcRef.current.rotation.z += 0.005;
  });

  const points: [number, number, number][] = [];
  const arcAngle = (score / 100) * Math.PI * 2;
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * arcAngle - Math.PI / 2;
    points.push([Math.cos(angle) * 2.2, Math.sin(angle) * 2.2, 0]);
  }

  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#ef4444' : '#dc2626';

  return (
    <Line ref={arcRef as any} points={points} color={color} lineWidth={2} transparent opacity={0.7} />
  );
}

// ── Main Scene ──
function AIScene({ mood, speaking, trustScore }: Omit<AIAvatarProps, 'message'>) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.8} color="#818cf8" />
      <pointLight position={[-5, -5, 5]} intensity={0.4} color="#c084fc" />

      <CoreSphere mood={mood} speaking={speaking} />
      <Eyes mood={mood} speaking={speaking} />
      <OrbitalRings mood={mood} />
      <Particles mood={mood} />
      <TrustArc score={trustScore} />
    </>
  );
}

// ── Exported Component ──
export default function AITwinAvatar({ mood = 'neutral', speaking = false, message, trustScore = 100 }: AIAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.7)' });
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="w-48 h-48 rounded-full overflow-hidden" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.1), transparent)' }}>
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }} style={{ background: 'transparent' }}>
          <AIScene mood={mood} speaking={speaking} trustScore={trustScore} />
        </Canvas>
      </div>

      {/* Status indicator */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
          mood === 'critical' ? 'bg-red-500/20 text-red-400 animate-pulse' :
          mood === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
          mood === 'alert' ? 'bg-orange-500/20 text-orange-400' :
          'bg-indigo-500/20 text-indigo-400'
        }`}>
          {mood === 'critical' ? '⚠ Critical' : mood === 'warning' ? '⚠ Warning' : mood === 'alert' ? '! Alert' : '● Active'}
        </div>
      </div>

      {/* Speech bubble */}
      {message && speaking && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 max-w-xs px-4 py-2 rounded-xl text-xs text-white text-center"
          style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', backdropFilter: 'blur(10px)' }}>
          {message}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rotate-45"
            style={{ background: 'rgba(99,102,241,0.2)', borderRight: '1px solid rgba(99,102,241,0.3)', borderBottom: '1px solid rgba(99,102,241,0.3)' }} />
        </div>
      )}
    </div>
  );
}
