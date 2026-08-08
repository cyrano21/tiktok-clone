import fs from 'node:fs';
import path from 'node:path';

describe('ORKY PWA presentation', () => {
  it('uses valid manifest icon purposes', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/manifest.ts'), 'utf8');
    expect(source).not.toContain("purpose: 'any maskable'");
    expect(source).toMatch(/purpose:\s*'any'/);
    expect(source).toMatch(/purpose:\s*'maskable'/);
  });

  it('keeps bottom safe-area spacing valid for React Native Web', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/navigation/WebAppShell.tsx'), 'utf8');
    expect(source).not.toContain("paddingBottom: 'calc(");
    expect(source).toContain('useSafeAreaInsets');
    expect(source).toContain('insets.bottom');
  });

  it('does not force demo video details in production', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/screens/VideoDetailScreen.tsx'), 'utf8');
    expect(source).toContain("process.env.NEXT_PUBLIC_USE_DEMO !== 'false'");
    expect(source).not.toContain('const USE_DEMO = true');
  });
});
