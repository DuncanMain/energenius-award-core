// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import ToastProvider from '@/components/ToastProvider';

export const metadata: Metadata = {
  title: 'ENERGENIUS Sandbox Wallet',
  description: 'Your crypto wallet dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}