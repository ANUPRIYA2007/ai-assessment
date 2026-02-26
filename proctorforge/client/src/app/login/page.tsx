'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import gsap from 'gsap';

/* ── animated orbit ring ── */
function OrbitRing({ radius = 120, color = '#7c3aed', duration = 4, startAngle = 0 }: {
    radius?: number; color?: string; duration?: number; startAngle?: number;
}) {
    const dotRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!dotRef.current) return;
        let progress = startAngle / 360;
        const circumference = 2 * Math.PI * radius;

        const tick = () => {
            progress += 1 / (duration * 60);
            if (progress > 1) progress = 0;
            const angle = progress * 2 * Math.PI;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (dotRef.current) {
                dotRef.current.style.transform = `translate(${x}px, ${y}px)`;
            }
        };

        gsap.ticker.add(tick);
        return () => gsap.ticker.remove(tick);
    }, [radius, duration, startAngle]);

    const size = radius * 2 + 20;
    return (
        <div className="absolute pointer-events-none" style={{ width: size, height: size, top: '50%', left: '50%', marginTop: -size / 2, marginLeft: -size / 2 }}>
            <div style={{ width: size, height: size, borderRadius: '50%', border: `1px dashed ${color}25`, position: 'absolute' }} />
            <div ref={dotRef} style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 12px ${color}`, position: 'absolute', top: '50%', left: '50%', marginTop: -4, marginLeft: -4 }} />
        </div>
    );
}

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { login, isLoading, error, user, loadFromStorage, clearError } = useAuthStore();
    const router = useRouter();

    const leftRef = useRef<HTMLDivElement>(null);
    const rightRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLDivElement>(null);
    const fieldsRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
    useEffect(() => { if (user) router.push(`/${user.role}/dashboard`); }, [user, router]);

    useEffect(() => {
        if (!leftRef.current || !rightRef.current) return;
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo(leftRef.current, { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 1 })
            .fromTo(logoRef.current, { scale: 0.5, opacity: 0, rotationY: -90 }, { scale: 1, opacity: 1, rotationY: 0, duration: 0.9, ease: 'back.out(1.7)' }, '-=0.4')
            .fromTo(rightRef.current, { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, '-=0.7')
            .fromTo(
                fieldsRef.current ? fieldsRef.current.querySelectorAll('.field-row') : [],
                { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 0.6, ease: 'power2.out' }, '-=0.5'
            );
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try { await login(email, password); } catch { }
    };

    return (
        <div className="min-h-screen w-full flex overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg, #07070f 0%, #0d0d1a 50%, #100820 100%)' }}>
            {/* BG */}
            <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/10 blur-[120px] animate-blob pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-neon-cyan/8 blur-[100px] animate-blob pointer-events-none" style={{ animationDelay: '4s' }} />

            {/* ── LEFT PANEL ── */}
            <div ref={leftRef} className="hidden lg:flex flex-col items-center justify-center flex-1 relative px-16 py-12">
                {/* 3D orbit logo */}
                <div ref={logoRef} className="mb-10 relative" style={{ width: 200, height: 200 }}>
                    <OrbitRing radius={90} color="#7c3aed" duration={5} startAngle={0} />
                    <OrbitRing radius={65} color="#22d3ee" duration={3.5} startAngle={120} />
                    <OrbitRing radius={42} color="#a855f7" duration={2.5} startAngle={240} />
                    {/* Logo image — no white bg, just drop shadow */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 flex items-center justify-center" style={{ filter: 'drop-shadow(0 0 20px rgba(124,58,237,0.8))' }}>
                            <Image src="/testguard.png" alt="TestGuard" width={80} height={80} className="object-contain" style={{ mixBlendMode: 'screen' }} />
                        </div>
                    </div>
                </div>

                <h1 className="text-5xl font-black text-center mb-3 leading-tight">
                    <span className="text-gradient">TestGuard</span>
                </h1>
                <p className="text-slate-400 text-base text-center max-w-sm leading-relaxed mb-10">
                    AI-powered proctored assessments with real-time behavioral analysis
                </p>

                {[
                    { icon: '🧠', label: 'AI Face & Gaze Detection' },
                    { icon: '🔐', label: 'Zero-Trust Security' },
                    { icon: '⚡', label: 'Real-Time Behavioral Analysis' },
                    { icon: '📊', label: 'Detailed Score Analytics' },
                ].map(({ icon, label }, i) => (
                    <div key={i} className="flex items-center gap-3 mb-3 w-full max-w-xs glass rounded-xl px-4 py-3 hover-lift">
                        <span className="text-xl">{icon}</span>
                        <span className="text-sm font-medium text-slate-300">{label}</span>
                        <div className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    </div>
                ))}
            </div>

            {/* ── RIGHT PANEL ── */}
            <div ref={rightRef} className="w-full lg:w-[520px] flex flex-col items-center justify-center px-8 py-12 relative"
                style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>

                {/* Mobile logo */}
                <div className="lg:hidden mb-8 text-center flex flex-col items-center gap-3">
                    <div style={{ filter: 'drop-shadow(0 0 16px rgba(124,58,237,0.7))' }}>
                        <Image src="/testguard.png" alt="TestGuard" width={56} height={56} className="object-contain" style={{ mixBlendMode: 'screen' }} />
                    </div>
                    <h1 className="text-2xl font-black text-gradient">TestGuard</h1>
                    <p className="text-slate-500 text-xs">AI-Powered Assessment Platform</p>
                </div>

                <div className="w-full max-w-sm" ref={fieldsRef}>
                    <h2 className="text-3xl font-black text-white mb-1 field-row">Welcome back</h2>
                    <p className="text-slate-500 text-sm mb-8 field-row">Sign in to your TestGuard account</p>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl glass border border-red-500/20 text-red-400 text-sm flex items-center gap-3 field-row">
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div className="field-row">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Email address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    <svg className="w-4 h-4 text-slate-600 group-focus-within:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }}
                                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm font-medium focus:outline-none focus:border-brand-500/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-brand-500/30 transition-all hover:border-white/[0.14]"
                                    placeholder="name@school.edu" required autoComplete="email" />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="field-row">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Password</label>
                                <button type="button" className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors">Forgot password?</button>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    <svg className="w-4 h-4 text-slate-600 group-focus-within:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }}
                                    className="w-full pl-11 pr-12 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm font-medium focus:outline-none focus:border-brand-500/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-brand-500/30 transition-all hover:border-white/[0.14]"
                                    placeholder="••••••••••" required autoComplete="current-password" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                                    {showPassword
                                        ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    }
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="field-row pt-2">
                            <button type="submit" disabled={isLoading}
                                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                                onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.02, boxShadow: '0 8px 25px rgba(124,58,237,0.5)', duration: 0.2 })}
                                onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2 })}>
                                {isLoading ? (
                                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Signing in...</>
                                ) : (
                                    <>Sign in<svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="my-8 flex items-center gap-4 field-row">
                        <div className="flex-1 h-px bg-white/[0.06]" />
                        <span className="text-xs text-slate-600 font-medium">or</span>
                        <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>

                    <p className="text-center text-sm text-slate-500 field-row">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">Create account →</Link>
                    </p>

                    <div className="mt-10 pt-6 border-t border-white/[0.05] flex items-center justify-center gap-2 field-row">
                        <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-slate-600">Protected by 256-bit AES encryption</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
