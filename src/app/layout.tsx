import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Sabari Wood Arts | Admin',
  description: 'Internal admin panel to manage Clients, Projects, Materials, Payments, and Labour costs.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          {/* Mobile top header bar */}
          <header className="top-header">
            <h1>Sabari Wood Arts</h1>
          </header>

          {/* Combined Desktop Sidebar & Mobile Bottom Tabs */}
          <Navigation />

          {/* Main content grid */}
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
