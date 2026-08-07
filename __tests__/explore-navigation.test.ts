import fs from 'node:fs';
import path from 'node:path';

describe('Discover category navigation', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/screens/ExploreScreen.tsx'),
    'utf8',
  );

  it('keeps the horizontal category rail measurable and scrollable', () => {
    expect(source).toMatch(/tabsContainer:\s*\{[^}]*height:\s*48/s);
    expect(source).toMatch(/tabsContainer:\s*\{[^}]*flexGrow:\s*0/s);
    expect(source).toMatch(/tabsContent:\s*\{[^}]*flexGrow:\s*0/s);
    expect(source).not.toMatch(/tabsContainer:\s*\{[^}]*maxHeight:/s);
  });
});
