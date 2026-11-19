import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: { default: 'CampusCrew — safe shared rides for your campus', template: '%s · CampusCrew' },
  description: 'Verified, gender-safe cab, train and flight buddy matching for Indian campuses. Split fares, save money, cut CO₂.',
  applicationName: 'CampusCrew',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'CampusCrew', statusBarStyle: 'default' },
};

export const viewport: Viewport = { themeColor: '#312e81', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
