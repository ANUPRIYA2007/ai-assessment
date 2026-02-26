'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/stores/authStore';
import gsap from 'gsap';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    tab?: string; // for tab-based admin nav
}

interface DashboardLayoutProps {
    children: React.ReactNode;
    role: 'student' | 'teacher' | 'admin';
}

const studentNav: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/student/dashboard',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
    },
    {
        label: 'Join Live Session',
        href: '/student/join',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    },
    {
        label: 'My Exams',
        href: '/student/dashboard?tab=exams',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
];

const teacherNav: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/teacher/dashboard',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
    },
    {
        label: 'Live Assessment',
        href: '/teacher/live',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
        label: 'Create MCQ',
        href: '/teacher/create-mcq',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    },
    {
        label: 'Create Coding',
        href: '/teacher/create-coding',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    },
];

const adminNav: NavItem[] = [
    {
        label: 'Overview', href: '/admin/dashboard?tab=overview', tab: 'overview',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
    },
    {
        label: 'Classes', href: '/admin/dashboard?tab=classes', tab: 'classes',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    },
    {
        label: 'Students', href: '/admin/dashboard?tab=students', tab: 'students',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
    {
        label: 'Test Management', href: '/admin/dashboard?tab=tests', tab: 'tests',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
];

const navByRole = { student: studentNav, teacher: teacherNav, admin: adminNav };

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logout } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const sidebarRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const navItemsRef = useRef<HTMLDivElement>(null);

    const navItems = navByRole[role] ?? studentNav;
    const currentTab = searchParams?.get('tab') || '';

    useEffect(() => {
        if (!sidebarRef.current || !contentRef.current) return;
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo(sidebarRef.current, { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.65 });
        tl.fromTo(contentRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, '-=0.3');
        if (navItemsRef.current) {
            tl.fromTo(
                navItemsRef.current.querySelectorAll('.nav-item'),
                { x: -16, opacity: 0 },
                { x: 0, opacity: 1, stagger: 0.06, duration: 0.35 },
                '-=0.2'
            );
        }
    }, []);

    const handleLogout = () => {
        gsap.to([sidebarRef.current, contentRef.current], {
            opacity: 0, duration: 0.25, onComplete: () => {
                logout();
                router.push('/login');
            }
        });
    };

    /* For admin nav: active = current tab matches item tab; else exact path */
    const isActive = (item: NavItem) => {
        if (item.tab) return currentTab === item.tab || (!currentTab && item.tab === 'overview');
        return pathname === item.href;
    };

    const roleAccent: Record<string, { from: string; to: string; glow: string }> = {
        student: { from: '#7c3aed', to: '#a855f7', glow: 'rgba(124,58,237,0.3)' },
        teacher: { from: '#0891b2', to: '#22d3ee', glow: 'rgba(34,211,238,0.3)' },
        admin: { from: '#db2777', to: '#a855f7', glow: 'rgba(219,39,119,0.3)' },
    };
    const accent = roleAccent[role] || roleAccent.student;

    return (
        <div className="min-h-screen flex bg-dark-900 overflow-hidden">

            {/* ══ SIDEBAR ══ */}
            <aside
                ref={sidebarRef}
                className="w-64 flex-shrink-0 flex flex-col relative z-20"
                style={{
                    background: 'linear-gradient(180deg, rgba(13,13,26,0.98) 0%, rgba(7,7,15,0.98) 100%)',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                }}
            >
                {/* Logo */}
                <div className="px-5 py-5 border-b border-white/[0.05]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, boxShadow: `0 0 16px ${accent.glow}` }}>
                            <Image src="/testguard.png" alt="TestGuard" width={22} height={22} className="object-contain" style={{ filter: 'brightness(10)' }} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white leading-none tracking-tight">TestGuard</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">{role} portal</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto" ref={navItemsRef}>
                    {navItems.map((item) => {
                        const active = isActive(item);
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative overflow-hidden ${active ? 'text-white' : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'}`}
                                style={active ? { background: `linear-gradient(135deg, ${accent.from}25, ${accent.to}18)`, border: `1px solid ${accent.from}30` } : {}}
                                onMouseEnter={(e) => { if (!active) gsap.to(e.currentTarget, { x: 4, duration: 0.18 }); }}
                                onMouseLeave={(e) => { if (!active) gsap.to(e.currentTarget, { x: 0, duration: 0.25 }); }}
                            >
                                {active && <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ background: `linear-gradient(180deg, ${accent.from}, ${accent.to})` }} />}
                                <span style={{ color: active ? accent.to : undefined }} className={active ? '' : 'text-slate-600 group-hover:text-slate-300 transition-colors'}>
                                    {item.icon}
                                </span>
                                <span className="flex-1">{item.label}</span>
                                {active && <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent.to }} />}
                            </Link>
                        );
                    })}
                </nav>

                {/* User */}
                <div className="px-3 py-4 border-t border-white/[0.05]">
                    {user && (
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}>
                                {user.name?.charAt(0)?.toUpperCase() ?? 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                                <p className="text-[10px] text-slate-600 truncate">{user.email}</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-all duration-150"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                    </button>
                </div>

                {/* Ambient */}
                <div className="absolute top-1/3 left-0 w-40 h-40 rounded-full blur-3xl pointer-events-none -translate-x-1/2 opacity-20" style={{ background: accent.from }} />
            </aside>

            {/* ══ MAIN ══ */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Topbar */}
                <header
                    className="flex items-center justify-between px-8 py-3.5 flex-shrink-0"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(20px)' }}
                >
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                        </div>
                        <span className="text-xs text-slate-600 ml-2 capitalize">{role} — {pathname?.split('/').slice(-1)[0] || 'dashboard'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full text-xs text-slate-500" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        AI Proctor Active
                    </div>
                </header>

                {/* Content */}
                <main ref={contentRef} className="flex-1 overflow-y-auto px-8 py-8">
                    <div className="fixed inset-0 bg-dot-pattern opacity-10 pointer-events-none" />
                    <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none opacity-30" style={{ background: `radial-gradient(circle, ${accent.from}18 0%, transparent 70%)` }} />
                    <div className="relative z-10">{children}</div>
                </main>
            </div>
        </div>
    );
}
