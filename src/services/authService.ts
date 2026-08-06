import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api';

const TOKEN_KEY = '@auth_token';
const REFRESH_TOKEN_KEY = '@refresh_token';
const USER_KEY = '@auth_user';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
}

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

/** Real auth against the Fastify backend. Tokens persist in AsyncStorage. */
export const authService = {
  async login(identifier: string, password: string): Promise<AuthUser> {
    const res = await apiClient.post<LoginResponse>('/auth/login', {
      // Backend controller reads `email` (accepts email or username value).
      email: identifier,
      password,
    });
    await this.persistSession(res);
    return res.user;
  },

  async register(params: { email: string; username: string; password: string }): Promise<AuthUser> {
    const res = await apiClient.post<LoginResponse>('/auth/register', params);
    await this.persistSession(res);
    return res.user;
  },

  async persistSession(res: LoginResponse): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, res.accessToken);
    if (res.refreshToken) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
  },

  async updateProfile(params: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    website?: string;
  }): Promise<AuthUser> {
    const raw = await apiClient.patch<{ user: AuthUser }>('/auth/me', params);
    const user = raw.user;
    // Refresh the cached user so subsequent screens see the changes.
    const cached = await this.getCachedUser();
    await AsyncStorage.setItem(USER_KEY, JSON.stringify({ ...(cached ?? {}), ...user }));
    return user;
  },

  async logout(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
  },

  async isLoggedIn(): Promise<boolean> {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return !!token;
  },

  async getCachedUser(): Promise<AuthUser | null> {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};
