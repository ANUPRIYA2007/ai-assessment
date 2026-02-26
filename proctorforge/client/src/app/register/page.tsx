'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import gsap from 'gsap';

const inputClass =
    'w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm font-medium focus:outline-none focus:border-brand-500/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-brand-500/30 transition-all hover:border-white/[0.14]';

const selectClass =
    'w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#0d0d1a] border border-white/[0.08] text-white text-sm font-medium focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all hover:border-white/[0.14] appearance-none cursor-pointer';

/* ── Labelled input row ── */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="field-row">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{label}</label>
            {children}
        </div>
    );
}

/* ── Icon wrapper ── */
function FieldIcon({ icon }: { icon: React.ReactNode }) {
    return (
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-600 group-focus-within:text-brand-400 transition-colors">
            {icon}
        </div>
    );
}

export default function RegisterPage() {
    /* core fields */
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState('student');
    const [passwordError, setPasswordError] = useState('');

    /* student-specific fields */
    const [gender, setGender] = useState('');
    const [className, setClassName] = useState('');
    const [year, setYear] = useState('');
    const [section, setSection] = useState('');
    const [registerNo, setRegisterNo] = useState('');

    const { register, isLoading, error, user, loadFromStorage, clearError } = useAuthStore();
    const router = useRouter();
    const wrapRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const studentFieldsRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
    useEffect(() => { if (user) router.push(`/${user.role}/dashboard`); }, [user, router]);

    /* entrance animation */
    useEffect(() => {
        if (!wrapRef.current) return;
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo(wrapRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 });
        if (formRef.current) {
            tl.fromTo(
                formRef.current.querySelectorAll('.field-row'),
                { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.07, duration: 0.5 }, '-=0.4'
            );
        }
    }, []);

    /* animate in student fields when role switches to student */
    useEffect(() => {
        if (!studentFieldsRef.current) return;
        if (role === 'student') {
            gsap.fromTo(
                studentFieldsRef.current.querySelectorAll('.student-field'),
                { y: 20, opacity: 0, height: 0 },
                { y: 0, opacity: 1, height: 'auto', stagger: 0.08, duration: 0.5, ease: 'power3.out' }
            );
        }
    }, [role]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setPasswordError('Passwords do not match');
            if (formRef.current) gsap.fromTo(formRef.current, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,0.3)' });
            return;
        }
        setPasswordError('');

        const extra = role === 'student'
            ? { gender, class_name: className, year, section, register_number: registerNo }
            : {};

        try {
            await register(name, email, password, role, extra as any);
        } catch { }
    };

    const roles = [
        { value: 'student', label: 'Student', desc: 'Take exams', icon: '🎓', color: '#7c3aed' },
        { value: 'teacher', label: 'Instructor', desc: 'Create & monitor', icon: '📚', color: '#22d3ee' },
        { value: 'admin', label: 'Admin', desc: 'Manage system', icon: '⚙️', color: '#f59e0b' },
    ];

    const iconSvg = {
        user: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
        email: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
        lock: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
        check: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        gender: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        class: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
        year: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        reg: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center px-4 py-10 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #07070f 0%, #0d0d1a 60%, #100820 100%)' }}>
            {/* BG */}
            <div className="absolute inset-0 bg-dot-pattern opacity-25 pointer-events-none" />
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-700/10 blur-[120px] animate-blob pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-neon-cyan/5 blur-[100px] animate-blob pointer-events-none" style={{ animationDelay: '5s' }} />

            <div ref={wrapRef} className="relative z-10 w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-7">
                    <div className="flex justify-center mb-4" style={{ filter: 'drop-shadow(0 0 20px rgba(124,58,237,0.7))' }}>
                        <Image src="/testguard.png" alt="TestGuard" width={64} height={64} className="object-contain" style={{ mixBlendMode: 'screen' }} />
                    </div>
                    <h1 className="text-3xl font-black text-gradient">TestGuard</h1>
                    <p className="text-slate-500 text-sm mt-1">Create your account</p>
                </div>

                {/* Card */}
                <div className="rounded-2xl p-7 glass border border-white/[0.07]" style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
                    {/* error */}
                    {(error || passwordError) && (
                        <div className="mb-5 p-3.5 rounded-xl glass border border-red-500/20 text-red-400 text-sm flex items-center gap-2.5 field-row">
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error || passwordError}
                        </div>
                    )}

                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <FieldRow label="Full Name">
                            <div className="relative group">
                                <FieldIcon icon={iconSvg.user} />
                                <input type="text" value={name} onChange={(e) => { setName(e.target.value); clearError(); }}
                                    className={inputClass} placeholder="John Doe" required autoComplete="name" />
                            </div>
                        </FieldRow>

                        {/* Email */}
                        <FieldRow label="Email">
                            <div className="relative group">
                                <FieldIcon icon={iconSvg.email} />
                                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }}
                                    className={inputClass} placeholder="name@school.edu" required autoComplete="email" />
                            </div>
                        </FieldRow>

                        {/* Password */}
                        <FieldRow label="Password">
                            <div className="relative group">
                                <FieldIcon icon={iconSvg.lock} />
                                <input type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={(e) => { setPassword(e.target.value); clearError(); setPasswordError(''); }}
                                    className={inputClass.replace('pr-4', 'pr-12')} placeholder="Min. 6 characters" required minLength={6} autoComplete="new-password" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                                    {showPassword
                                        ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    }
                                </button>
                            </div>
                        </FieldRow>

                        {/* Confirm Password */}
                        <FieldRow label="Confirm Password">
                            <div className="relative group">
                                <FieldIcon icon={iconSvg.check} />
                                <input type={showPassword ? 'text' : 'password'} value={confirmPassword}
                                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                                    className={`${inputClass} ${confirmPassword && confirmPassword !== password ? 'border-red-500/40' : ''}`}
                                    placeholder="Re-enter password" required minLength={6} autoComplete="new-password" />
                            </div>
                        </FieldRow>

                        {/* ── Role Selection ── */}
                        <div className="field-row">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Select Role</label>
                            <div className="grid grid-cols-3 gap-3">
                                {roles.map(({ value, label, desc, icon, color }) => (
                                    <button key={value} type="button" onClick={() => setRole(value)}
                                        className="py-4 rounded-xl text-center transition-all duration-250 flex flex-col items-center gap-1.5 relative overflow-hidden"
                                        style={{
                                            background: role === value ? `${color}1a` : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${role === value ? color + '55' : 'rgba(255,255,255,0.07)'}`,
                                            boxShadow: role === value ? `0 0 20px ${color}18` : 'none',
                                        }}>
                                        <span className="text-xl">{icon}</span>
                                        <span className="text-xs font-bold text-white">{label}</span>
                                        <span className="text-[10px] text-slate-600">{desc}</span>
                                        {role === value && (
                                            <div className="absolute top-0 left-0 right-0 h-px"
                                                style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── STUDENT-SPECIFIC FIELDS ── */}
                        <div ref={studentFieldsRef}>
                            {role === 'student' && (
                                <>
                                    {/* divider */}
                                    <div className="student-field flex items-center gap-3 my-2">
                                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)' }} />
                                        <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest px-2 py-1 rounded-md" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                                            Student Details
                                        </span>
                                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)' }} />
                                    </div>

                                    {/* Gender */}
                                    <div className="student-field field-row">
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Gender</label>
                                        <div className="relative group">
                                            <FieldIcon icon={iconSvg.gender} />
                                            <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass} required>
                                                <option value="" disabled className="bg-dark-800 text-slate-500">Select gender</option>
                                                <option value="male" className="bg-dark-800">Male</option>
                                                <option value="female" className="bg-dark-800">Female</option>
                                                <option value="other" className="bg-dark-800">Prefer not to say</option>
                                            </select>
                                            {/* dropdown arrow */}
                                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Class, Year & Section */}
                                    <div className="student-field field-row">
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Class Name</label>
                                        <div className="relative group">
                                            <FieldIcon icon={iconSvg.class} />
                                            <input type="text" value={className} onChange={(e) => setClassName(e.target.value)}
                                                className={inputClass} placeholder="e.g. Computer Science, BCA" required />
                                        </div>
                                    </div>

                                    <div className="student-field grid grid-cols-2 gap-4 field-row">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Academic Year</label>
                                            <div className="relative group">
                                                <FieldIcon icon={iconSvg.year} />
                                                <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass} required>
                                                    <option value="" disabled className="bg-dark-800">Select year</option>
                                                    {['1st', '2nd', '3rd', '4th', '5th'].map((y) => (
                                                        <option key={y} value={y} className="bg-dark-800">{y} Year</option>
                                                    ))}
                                                </select>
                                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Section</label>
                                            <div className="relative group">
                                                <FieldIcon icon={iconSvg.class} />
                                                <input type="text" value={section} onChange={(e) => setSection(e.target.value)}
                                                    className={inputClass} placeholder="A / B / C" required />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Register Number */}
                                    <div className="student-field field-row">
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Register Number</label>
                                        <div className="relative group">
                                            <FieldIcon icon={iconSvg.reg} />
                                            <input type="text" value={registerNo} onChange={(e) => setRegisterNo(e.target.value)}
                                                className={inputClass} placeholder="e.g. 21CS0001" required />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Submit */}
                        <div className="field-row pt-2">
                            <button type="submit" disabled={isLoading}
                                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                                onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.02, boxShadow: '0 8px 30px rgba(124,58,237,0.5)', duration: 0.2 })}
                                onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2 })}>
                                {isLoading ? (
                                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating Account...</>
                                ) : (
                                    <>Create Account<svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-5 pt-5 border-t border-white/[0.05] text-center field-row">
                        <p className="text-sm text-slate-500">
                            Already have an account?{' '}
                            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">Sign in →</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
