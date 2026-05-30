/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // Produce a self-contained server bundle for a small Docker runtime image.
  output: 'standalone',
  // react-native-web ships untranspiled ESM/Flow-ish code; transpile it + the
  // RN-ecosystem aliases so Next can bundle them for the browser.
  transpilePackages: ['react-native-web'],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Map react-native -> react-native-web (the whole UI is RN-web).
      'react-native$': 'react-native-web',
      // Local web mocks for native-only packages (same set as the old Vite build).
      'react-native-safe-area-context': path.resolve(__dirname, 'src/mocks/react-native-safe-area-context.ts'),
      'react-native-reanimated': path.resolve(__dirname, 'src/mocks/react-native-reanimated.ts'),
      'react-native-gesture-handler': path.resolve(__dirname, 'src/mocks/react-native-gesture-handler.ts'),
      'react-native-haptic-feedback': path.resolve(__dirname, 'src/mocks/react-native-haptic-feedback.ts'),
      'react-native-video': path.resolve(__dirname, 'src/mocks/react-native-video.web.tsx'),
      'react-native-mmkv': path.resolve(__dirname, 'src/mocks/react-native-mmkv.ts'),
      // Source path aliases (mirror tsconfig paths).
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@screens': path.resolve(__dirname, 'src/screens'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@store': path.resolve(__dirname, 'src/store'),
      '@theme': path.resolve(__dirname, 'src/theme'),
      '@types': path.resolve(__dirname, 'src/types'),
    };
    // RN-web resolves platform files; prefer .web.* then plain.
    config.resolve.extensions = [
      '.web.tsx', '.web.ts', '.web.js',
      '.tsx', '.ts', '.jsx', '.js', '.json',
      ...config.resolve.extensions,
    ];
    return config;
  },
};

module.exports = nextConfig;
