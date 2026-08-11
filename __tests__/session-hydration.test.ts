import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { authService } from '../src/services/authService';
import { useSessionStore } from '../src/store/sessionStore';

// On web the PR moved the refresh flow behind an HttpOnly cookie: the access
// token lives in memory (authTokenStore.webAccessToken) and bootstrap hits
// /api/auth/session/refresh with the cookie instead of reading AsyncStorage.
describe('session hydration (web — HttpOnly cookie session)', () => {
  const postSpy = jest.spyOn(axios, 'post');

  beforeEach(async () => {
    useSessionStore.getState().clearUser();
    await AsyncStorage.multiRemove(['@auth_token', '@refresh_token', '@auth_user']);
    postSpy.mockReset();
  });

  afterAll(() => {
    postSpy.mockRestore();
  });

  it('restores the cached account when the HttpOnly-cookie session refreshes', async () => {
    postSpy.mockResolvedValue({ data: { accessToken: 'access-token' } } as any);
    await AsyncStorage.setItem('@auth_user', JSON.stringify({
      id: 'user-7',
      username: 'real_creator',
      email: 'creator@example.com',
      displayName: 'Real Creator',
      avatarUrl: 'https://example.com/avatar.jpg',
    }));

    await authService.hydrateSession();

    expect(postSpy).toHaveBeenCalledWith('/api/auth/session/refresh', undefined, expect.anything());
    expect(useSessionStore.getState()).toMatchObject({
      userId: 'user-7',
      username: 'real_creator',
      displayName: 'Real Creator',
      authenticated: true,
    });
  });

  it('keeps the session unauthenticated when the cookie session cannot be refreshed', async () => {
    postSpy.mockRejectedValue(new Error('No valid HttpOnly session cookie'));

    await authService.hydrateSession();

    expect(useSessionStore.getState().authenticated).toBe(false);
    expect(useSessionStore.getState().userId).toBe('');
  });
});
