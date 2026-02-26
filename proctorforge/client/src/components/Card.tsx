import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    style?: React.CSSProperties;
}

export function Card({ children, className = '', onClick, style }: CardProps) {
    return (
        <div
            onClick={onClick}
            className={`rounded-2xl p-6 relative overflow-hidden ${className}`}
            style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                ...style,
            }}
        >
            {children}
        </div>
    );
}

export default Card;
