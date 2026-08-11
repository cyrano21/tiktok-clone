import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api';
import {
  USER_KEY,
  clearSecretTokens,
  getAccessToken,
  isWebRuntime,
  setAccessToken,
  setRefreshToken,
} from './authTokenStore';
import { useSessionStore } from '@/store/sessionStore';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  role?: string;
}

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

async function webAuthRequest(path: 'login' | 'register', body: unknown): Promise<LoginResponse> {
  const response = await fetch(`/api/auth/session/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || 'Authentication failed');
    (error as any).status = response.status;
    throw error;
  }
  return payload as LoginResponse;
}

export const authService = {
  async login(identifier: string, password: string): Promise<AuthUser> {
    const params = { email: identifier, password };
    const res = isWebRuntime()
      ? await webAuthRequest('login', params)
      : await apiClient.post<LoginResponse>('/auth/login', params);
    await this.persistSession(res);
    return res.user;
  },

  async register(params: { email: string; username: string; password: string }): Promise<AuthUser> {
    const res = isWebRuntime()
      ? await webAuthRequest('register', params)
      : await apiClient.post<LoginResponse>('/auth/register', params);
    await this.persistSession(res);
    return res.user;
  },

  async persistSession(res: LoginResponse): Promise<void> {
    await setAccessToken(res.accessToken);
    await setRefreshToken(res.refreshToken || null);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
    useSessionStore.getState().setUser(res.user);
  },

  async updateProfile(params: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    website?: string;
  }): Promise<AuthUser> {
    const raw = await apiClient.patch<{ user: AuthUser }>('/auth/me', params);
    const user = raw.user;
    useSessionStore.getState().setUser(user);
    const cached = await this.getCachedUser();
    await AsyncStorage.setItem(USER_KEY, JSON.stringify({ ...(cached ?? {}), ...user }));
    return user;
  },

  async logout(): Promise<void> {
    try {
      if (isWebRuntime()) {
        const token = await getAccessToken();
        await fetch('/api/auth/session/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: token ? { authorization: `Bearer ${token}` } : undefined,
        });
      } else {
        await apiClient.post('/auth/logout');
      }
    } catch {
      // Best effort: local logout must never be blocked by network availability.
    } finally {
      await clearSecretTokens();
      await AsyncStorage.removeItem(USER_KEY);
      useSessionStore.getState().clearUser();
    }
  },

  async isLoggedIn(): Promise<boolean> {
    if (isWebRuntime()) {
      return apiClient.bootstrapWebSession();
    }
    return Boolean(await getAccessToken());
  },

  async hydrateSession(): Promise<void> {
    let authenticated = false;
    if (isWebRuntime()) {
      authenticated = await apiClient.bootstrapWebSession();
    } else {
      authenticated = Boolean(await getAccessToken());
    }

    if (!authenticated) {
      await AsyncStorage.removeItem(USER_KEY);
      useSessionStore.getState().clearUser();
      return;
    }

    let user = await this.getCachedUser();
    if (!user) {
      try {
        const response = await apiClient.get<{ user: AuthUser }>('/auth/me');
        user = response.user;
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch {
        await clearSecretTokens();
        useSessionStore.getState().clearUser();
        return;
      }
    }
    useSessionStore.getState().setUser(user);
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
