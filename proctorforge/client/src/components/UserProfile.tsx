'use client';

import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/authStore';

interface UserProfileProps {
  compact?: boolean;
  showSettings?: boolean;
}

export default function UserProfile({ compact = false, showSettings = true }: UserProfileProps) {
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<string>('default');
  const menuRef = useRef<HTMLDivElement>(null);

  const stickers = [
    { id: 'default', emoji: '👤', label: 'Default' },
    { id: 'student', emoji: '🎓', label: 'Student' },
    { id: 'teacher', emoji: '👨‍🏫', label: 'Teacher' },
    { id: 'star', emoji: '⭐', label: 'Star' },
    { id: 'rocket', emoji: '🚀', label: 'Rocket' },
    { id: 'brain', emoji: '🧠', label: 'Brain' },
    { id: 'trophy', emoji: '🏆', label: 'Trophy' },
    { id: 'fire', emoji: '🔥', label: 'Fire' },
  ];

  // Animation on menu open
  useEffect(() => {
    if (menuRef.current) {
      if (isOpen) {
        gsap.to(menuRef.current, {
          opacity: 1,
          y: 0,
          pointerEvents: 'auto',
          duration: 0.3,
          ease: 'power2.out',
        });
      } else {
        gsap.to(menuRef.current, {
          opacity: 0,
          y: -10,
          pointerEvents: 'none',
          duration: 0.2,
          ease: 'power2.in',
        });
      }
    }
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  const handleStickerChange = (stickerId: string) => {
    setSelectedSticker(stickerId);
    // Save to localStorage or backend
    localStorage.setItem(`${user?.id}_profile_sticker`, stickerId);
  };

  const currentSticker = stickers.find(s => s.id === selectedSticker);

  if (!user) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-purple-400/20 hover:border-purple-400/40 transition-all duration-300">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg">
          {currentSticker?.emoji}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-purple-300/60 capitalize">{user.role}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-purple-400/30 hover:border-purple-400/60 transition-all duration-300 group hover:shadow-lg hover:shadow-indigo-600/20"
      >
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/50 group-hover:shadow-indigo-500/75 transition-shadow">
          {currentSticker?.emoji}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-sm font-bold text-white">{user.name}</p>
          <p className="text-xs text-purple-300/60 capitalize">{user.role}</p>
        </div>
        <svg className={`w-5 h-5 text-purple-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div
        ref={menuRef}
        className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-purple-400/30 shadow-2xl shadow-purple-900/50 opacity-0 translate-y-2 pointer-events-none z-50"
      >
        {/* Profile Header */}
        <div className="p-6 border-b border-purple-400/20">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl shadow-lg">
              {currentSticker?.emoji}
            </div>
            <div>
              <p className="text-lg font-bold text-white">{user.name}</p>
              <p className="text-sm text-purple-300/60">{user.email}</p>
              <p className="mt-1 px-3 py-1 rounded-full bg-indigo-600/30 text-xs font-semibold text-indigo-300 w-fit capitalize">
                {user.role}
              </p>
            </div>
          </div>
        </div>

        {/* Sticker Selection */}
        <div className="p-6 border-b border-purple-400/20">
          <p className="text-sm font-semibold text-purple-200 mb-4">Profile Sticker</p>
          <div className="grid grid-cols-4 gap-3">
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => handleStickerChange(sticker.id)}
                className={`p-3 rounded-xl font-bold text-2xl transition-all duration-300 transform hover:scale-110 ${
                  selectedSticker === sticker.id
                    ? 'bg-indigo-600 ring-2 ring-indigo-400'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
                title={sticker.label}
              >
                {sticker.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Account Info */}
        <div className="p-6 space-y-3 border-b border-purple-400/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-300/60">Account Type</span>
            <span className="font-semibold text-white capitalize">{user.role}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-300/60">Member Since</span>
            <span className="font-semibold text-white">Recently</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 space-y-3">
          <button className="w-full px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-all duration-300 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 font-semibold transition-all duration-300 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
