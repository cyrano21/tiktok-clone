import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
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
    },
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.js'],
  },
  define: {
    __DEV__: JSON.stringify(true),
  },
  server: {
    port: 5173,
  },
});
