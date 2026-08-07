/** @type {import('next').NextConfig} */
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || (isProduction ? null : 'http://localhost:4000');

// In production without a backend URL, the app runs in demo mode (no throw).

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [{
      source: '/v1/:path*',
      destination: `${backendUrl}/v1/:path*`,
    }];
  },
  transpilePackages: ['react-native-web'],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native$': 'react-native-web',
      'react-native-safe-area-context': path.resolve(__dirname, 'src/mocks/react-native-safe-area-context.ts'),
      'react-native-reanimated': path.resolve(__dirname, 'src/mocks/react-native-reanimated.ts'),
      'react-native-gesture-handler': path.resolve(__dirname, 'src/mocks/react-native-gesture-handler.ts'),
      'react-native-haptic-feedback': path.resolve(__dirname, 'src/mocks/react-native-haptic-feedback.ts'),
      'react-native-video': path.resolve(__dirname, 'src/mocks/react-native-video.web.tsx'),
      'react-native-mmkv': path.resolve(__dirname, 'src/mocks/react-native-mmkv.ts'),
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@screens': path.resolve(__dirname, 'src/screens'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@store': path.resolve(__dirname, 'src/store'),
      '@theme': path.resolve(__dirname, 'src/theme'),
      '@types': path.resolve(__dirname, 'src/types'),
    };
    config.resolve.extensions = [
      '.web.tsx', '.web.ts', '.web.js',
      '.tsx', '.ts', '.jsx', '.js', '.json',
      ...config.resolve.extensions,
    ];
    return config;
  },
};

module.exports = nextConfig;
