import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../src/services/authService';
import { useSessionStore } from '../src/store/sessionStore';

describe('session hydration', () => {
  beforeEach(async () => {
    useSessionStore.getState().clearUser();
    await AsyncStorage.multiRemove(['@auth_token', '@refresh_token', '@auth_user']);
  });

  it('restores the cached account when an access token exists', async () => {
    await AsyncStorage.setItem('@auth_token', 'access-token');
    await AsyncStorage.setItem('@auth_user', JSON.stringify({
      id: 'user-7',
      username: 'real_creator',
      email: 'creator@example.com',
      displayName: 'Real Creator',
      avatarUrl: 'https://example.com/avatar.jpg',
    }));

    await authService.hydrateSession();

    expect(useSessionStore.getState()).toMatchObject({
      userId: 'user-7',
      username: 'real_creator',
      displayName: 'Real Creator',
      authenticated: true,
    });
  });

  it('keeps the demo session unauthenticated without a token', async () => {
    await authService.hydrateSession();
    expect(useSessionStore.getState().authenticated).toBe(false);
  });
});
