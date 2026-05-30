import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TikTok Clone',
  description:
    'Full TikTok clone (feed, shop, studio, official TikTok OAuth + Content Posting API) — React Native Web on Next.js.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
