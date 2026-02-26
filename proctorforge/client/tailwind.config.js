/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f0f0ff',
                    100: '#e0e0ff',
                    200: '#c4c2ff',
                    300: '#a99bff',
                    400: '#8b71ff',
                    500: '#7c3aed',
                    600: '#6d28d9',
                    700: '#5b21b6',
                    800: '#4c1d95',
                    900: '#2e1065',
                    950: '#1a0840',
                },
                neon: {
                    purple: '#a855f7',
                    cyan: '#22d3ee',
                    blue: '#3b82f6',
                    pink: '#ec4899',
                    green: '#10b981',
                },
                dark: {
                    900: '#07070f',
                    800: '#0d0d1a',
                    700: '#121222',
                    600: '#191930',
                    500: '#1f1f3e',
                },
            },
            fontFamily: {
                sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            backgroundImage: {
                'glow-purple': 'radial-gradient(ellipse at center, rgba(124,58,237,0.3) 0%, transparent 70%)',
                'glow-cyan': 'radial-gradient(ellipse at center, rgba(34,211,238,0.2) 0%, transparent 70%)',
                'grid': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cpath d='M0 0L80 0 80 80 0 80 0 0' fill='none' stroke='rgba(124,58,237,0.08)' stroke-width='1'/%3E%3C/svg%3E\")",
            },
            boxShadow: {
                'neon-purple': '0 0 30px rgba(124,58,237,0.4), 0 0 60px rgba(124,58,237,0.2)',
                'neon-cyan': '0 0 30px rgba(34,211,238,0.4), 0 0 60px rgba(34,211,238,0.2)',
                'glow-sm': '0 0 10px rgba(124,58,237,0.3)',
                'glass': '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                'card': '0 20px 60px rgba(0,0,0,0.5)',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'float-slow': 'float 10s ease-in-out infinite',
                'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
                'spin-slow': 'spin 8s linear infinite',
                'shimmer': 'shimmer 2s linear infinite',
                'slide-up': 'slideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'blob': 'blob 12s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%,100%': { transform: 'translateY(0px) rotate(0deg)' },
                    '33%': { transform: 'translateY(-15px) rotate(1deg)' },
                    '66%': { transform: 'translateY(-8px) rotate(-1deg)' },
                },
                pulseGlow: {
                    '0%,100%': { boxShadow: '0 0 20px rgba(124,58,237,0.3)' },
                    '50%': { boxShadow: '0 0 50px rgba(124,58,237,0.7), 0 0 100px rgba(124,58,237,0.3)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-1000px 0' },
                    '100%': { backgroundPosition: '1000px 0' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                blob: {
                    '0%,100%': { transform: 'translate(0, 0) scale(1)' },
                    '25%': { transform: 'translate(30px,-40px) scale(1.05)' },
                    '50%': { transform: 'translate(-20px,-60px) scale(0.95)' },
                    '75%': { transform: 'translate(20px,20px) scale(1.05)' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
};
