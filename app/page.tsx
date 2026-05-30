'use client';

import dynamic from 'next/dynamic';

// react-native-web must run in the browser only (no SSR): it reads Dimensions
// and window at module/render time. Disable SSR for the app shell.
const AppClient = dynamic(() => import('./AppClient'), {
  ssr: false,
  loading: () => null,
});

export default function HomePage() {
  return <AppClient />;
}
