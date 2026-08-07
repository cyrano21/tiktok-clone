import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'),
  title: 'ORKY — plateforme vidéo par Orchidy',
  description:
    'ORKY by Orchidy : feed vidéo, studio de création, live, shop, modération et analytics — plateforme complète.',
  icons: { icon: '/favicon.png' },
  openGraph: {
    title: 'ORKY by Orchidy',
    description: 'Feed vidéo, studio de création, live, shop, modération et analytics.',
    images: ['/logo_orky.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090F',
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
