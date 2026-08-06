import fs from 'node:fs';
import path from 'node:path';

describe('Discover viewport layout', () => {
  it('reserves bottom clearance for the fixed navigation bar', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/ExploreScreen.tsx'),
      'utf8',
    );

    expect(source).toMatch(
      /gridContent:\s*\{[^}]*paddingBottom:\s*(?:9[0-9]|1[0-9]{2})/s,
    );
  });
});
