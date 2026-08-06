import { readFileSync } from 'fs';
import { join } from 'path';

const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('interactive control audit', () => {
  test('main feed tabs both have navigation actions', () => {
    const forYou = source('src/screens/ForYouScreen.tsx');
    const following = source('src/screens/feed/FollowingScreen.tsx');

    expect(forYou).toContain("nav.replace('feed.following')");
    expect(forYou).toContain("nav.replace('feed.foryou')");
    expect(following).toContain("nav.replace('feed.foryou')");
    expect(following).toContain("nav.replace('feed.following')");
  });

  test('search actions mutate recent searches instead of being no-ops', () => {
    const search = source('src/screens/explore/SearchScreen.tsx');

    expect(search).toContain('setRecentSearches([])');
    expect(search).toContain('removeRecentSearch');
  });

  test('shareable screens use the shared share action', () => {
    for (const file of [
      'src/screens/ProfileScreen.tsx',
      'src/screens/explore/HashtagScreen.tsx',
      'src/screens/explore/SoundScreen.tsx',
      'src/screens/live/LiveScreen.tsx',
    ]) {
      expect(source(file)).toContain('shareText');
    }
  });

  test('camera and call controls have stateful handlers', () => {
    for (const file of [
      'src/screens/create/RecordScreen.tsx',
      'src/screens/live/LiveBroadcastScreen.tsx',
      'src/screens/call/VideoCallScreen.tsx',
    ]) {
      const content = source(file);
      expect(content).toMatch(/onPress=\{\(\) =>/);
      expect(content).not.toMatch(/<TouchableOpacity style=\{styles\.(sideButton|flipButton|controlButton)\}>/);
    }
  });

  test('all route registry entries resolve to screens', () => {
    const registry = source('src/navigation/screenRegistry.tsx');
    const context = source('src/navigation/NavigationContext.tsx');
    const routeNames = [...context.matchAll(/\| '([^']+)'/g)].map((m) => m[1]);
    const registryBody = registry.slice(registry.indexOf('SCREEN_REGISTRY'), registry.indexOf('TAB_ROUTES'));

    for (const route of routeNames) {
      const keyPattern = route.includes('.') ? `'${route}':` : new RegExp(`(?:^|\\n)\\s*${route}:`);
      expect(registryBody).toMatch(keyPattern);
    }
  });
});
