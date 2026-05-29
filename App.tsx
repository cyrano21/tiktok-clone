import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationProvider } from './src/navigation/NavigationContext';
import { WebAppShell } from './src/navigation/WebAppShell';

export function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <NavigationProvider initial={{ name: 'feed.foryou' }}>
        <WebAppShell />
      </NavigationProvider>
    </SafeAreaProvider>
  );
}
