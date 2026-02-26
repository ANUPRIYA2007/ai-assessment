import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TestGuard — AI-Powered Assessment Platform',
  description: 'AI-native, zero-trust proctored assessment platform with real-time behavioral analysis.',
  keywords: 'TestGuard, proctoring, AI, assessment, exam, zero-trust',
  icons: {
    icon: [
      { url: '/testguard.png', type: 'image/png' },
    ],
    apple: '/testguard.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-dark-900 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
