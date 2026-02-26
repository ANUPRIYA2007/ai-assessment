import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    glow?: boolean;
    loading?: boolean;
}

const variants = {
    primary: 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg hover:shadow-brand-700/40',
    secondary: 'bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:border-white/[0.14]',
    danger: 'bg-gradient-to-r from-red-700 to-red-500 text-white shadow-lg hover:shadow-red-700/40',
    ghost: 'text-slate-400 hover:text-white hover:bg-white/[0.05]',
};

const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl',
    lg: 'px-7 py-3.5 text-base rounded-2xl',
};

export function Button({
    children, variant = 'primary', size = 'md', glow = false,
    loading = false, className = '', disabled, ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            disabled={loading || disabled}
            className={`
        inline-flex items-center justify-center gap-2 font-semibold
        transition-all duration-200 cursor-pointer select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]
        ${variants[variant]}
        ${sizes[size]}
        ${glow ? 'shadow-neon-purple' : ''}
        ${className}
      `}
        >
            {loading && (
                <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            )}
            {children}
        </button>
    );
}

export default Button;
