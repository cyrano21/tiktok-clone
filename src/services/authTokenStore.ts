import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const TOKEN_KEY = '@auth_token';
export const REFRESH_TOKEN_KEY = '@refresh_token';
export const USER_KEY = '@auth_user';

let webAccessToken: string | null = null;

export function isWebRuntime(): boolean {
  return Platform.OS === 'web';
}

export async function getAccessToken(): Promise<string | null> {
  if (isWebRuntime()) return webAccessToken;
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setAccessToken(token: string | null): Promise<void> {
  if (isWebRuntime()) {
    webAccessToken = token || null;
    return;
  }
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  if (isWebRuntime()) return null;
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string | null): Promise<void> {
  if (isWebRuntime()) return;
  if (token) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
  else await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function clearSecretTokens(): Promise<void> {
  webAccessToken = null;
  if (!isWebRuntime()) {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
  }
}
