'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore } from '@/stores/authStore';
import gsap from 'gsap';

export default function Home() {
  const router = useRouter();
  const { user, loadFromStorage } = useAuthStore();
  const logoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (logoRef.current) {
      tl.fromTo(logoRef.current,
        { scale: 0.4, opacity: 0, rotationY: -90 },
        { scale: 1, opacity: 1, rotationY: 0, duration: 1, ease: 'back.out(1.5)', transformPerspective: 600 }
      );
      gsap.to(logoRef.current, {
        filter: 'drop-shadow(0 0 40px rgba(124,58,237,0.9)) drop-shadow(0 0 80px rgba(124,58,237,0.4))',
        repeat: -1, yoyo: true, duration: 1.8, ease: 'sine.inOut', delay: 0.8,
      });
    }

    if (textRef.current) {
      tl.fromTo(textRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, '-=0.3');
    }

    if (dotsRef.current) {
      gsap.to(dotsRef.current.querySelectorAll('.dot'), {
        scale: 1.6, opacity: 1, backgroundColor: '#7c3aed',
        stagger: { repeat: -1, yoyo: true, each: 0.25 }, duration: 0.35, delay: 0.6,
      });
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.push(user ? `/${user.role}/dashboard` : '/login');
    }, 1800);
    return () => clearTimeout(timeout);
  }, [user, router]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #07070f 0%, #0d0d1a 50%, #100820 100%)' }}>
      {/* Background */}
      <div className="absolute inset-0 bg-dot-pattern opacity-25 pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-brand-700/10 blur-[120px] animate-blob pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-neon-cyan/6 blur-[100px] animate-blob pointer-events-none" style={{ animationDelay: '3s' }} />

      {/* Logo — no box background, just the image with purple glow */}
      <div ref={logoRef} className="mb-8" style={{ filter: 'drop-shadow(0 0 24px rgba(124,58,237,0.7))' }}>
        <Image
          src="/testguard.png"
          alt="TestGuard"
          width={96}
          height={96}
          className="object-contain"
          style={{ mixBlendMode: 'screen' }}
          priority
        />
      </div>

      {/* Text */}
      <div ref={textRef} className="text-center">
        <h1 className="text-3xl font-black mb-2 text-gradient">TestGuard</h1>
        <p className="text-sm text-slate-500 mb-8">AI-Powered Assessment Platform</p>

        {/* Dots loader */}
        <div ref={dotsRef} className="flex items-center justify-center gap-2.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="dot w-2 h-2 rounded-full opacity-30 bg-brand-500" />
          ))}
        </div>
      </div>
    </div>
  );
}
