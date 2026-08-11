import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  USER_KEY,
  clearSecretTokens,
  getAccessToken,
  getRefreshToken,
  isWebRuntime,
  setAccessToken,
  setRefreshToken,
} from './authTokenStore';

function resolveBaseUrl(): string {
  const runtimeOverride =
    typeof globalThis !== 'undefined' && (globalThis as any).__TIKTOK_API_BASE__;
  if (typeof runtimeOverride === 'string' && runtimeOverride) return runtimeOverride;

  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof envBase === 'string' && envBase) return envBase;

  return '/v1';
}

const BASE_URL = resolveBaseUrl();

async function clearInvalidSession() {
  await clearSecretTokens();
  await AsyncStorage.removeItem(USER_KEY);
  try {
    const { useSessionStore } = await import('@/store/sessionStore');
    useSessionStore.getState().clearUser();
  } catch {
    // Storage cleanup is authoritative even if the UI store is unavailable.
  }
}

async function refreshAccessToken(): Promise<string> {
  if (isWebRuntime()) {
    const response = await axios.post('/api/auth/session/refresh', undefined, {
      headers: { 'content-type': 'application/json' },
      withCredentials: true,
      timeout: 15_000,
    });
    const accessToken = String(response.data?.accessToken || '');
    if (!accessToken) throw new Error('Invalid web refresh response');
    await setAccessToken(accessToken);
    return accessToken;
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');
  const response = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 15_000 });
  const accessToken = String(response.data?.accessToken || '');
  const newRefreshToken = String(response.data?.refreshToken || '');
  if (!accessToken || !newRefreshToken) throw new Error('Invalid refresh response');
  await setAccessToken(accessToken);
  await setRefreshToken(newRefreshToken);
  return accessToken;
}

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      async (config) => {
        const token = await getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
          const headers = config.headers as any;
          if (typeof headers.set === 'function') headers.set('Content-Type', undefined);
          else delete headers['Content-Type'];
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const isRefreshRequest =
          typeof originalRequest?.url === 'string' && originalRequest.url.includes('/auth/refresh');

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isRefreshRequest) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then((token) => {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.client(originalRequest);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const accessToken = await refreshAccessToken();
            this.processQueue(null, accessToken);
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.processQueue(refreshError, null);
            await clearInvalidSession();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      },
    );
  }

  private processQueue(error: unknown, token: string | null): void {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) reject(error);
      else resolve(token);
    });
    this.failedQueue = [];
  }

  async bootstrapWebSession(): Promise<boolean> {
    if (!isWebRuntime()) return Boolean(await getAccessToken());
    try {
      await refreshAccessToken();
      return true;
    } catch {
      await clearSecretTokens();
      return false;
    }
  }

  async currentAccessToken(): Promise<string | null> {
    return getAccessToken();
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }

  async upload<T>(url: string, formData: FormData, onProgress?: (progress: number) => void): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, formData, {
      timeout: 5 * 60 * 1000,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();
