import fs from 'node:fs';
import path from 'node:path';

describe('Discover child viewport layouts', () => {
  it.each([
    'src/screens/explore/HashtagScreen.tsx',
    'src/screens/explore/SoundScreen.tsx',
  ])('reserves bottom clearance in %s', (screenPath) => {
    const source = fs.readFileSync(path.join(process.cwd(), screenPath), 'utf8');

    expect(source).toMatch(
      /videoGrid:\s*\{[^}]*paddingBottom:\s*(?:9[0-9]|1[0-9]{2})/s,
    );
  });
});
