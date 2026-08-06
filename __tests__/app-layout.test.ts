import fs from 'node:fs';
import path from 'node:path';

describe('web app viewport layout', () => {
  it('gives html, body, and root a definite viewport height', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(css).toMatch(/html\s*\{[^}]*height:\s*100%/s);
    expect(css).toMatch(/body\s*\{[^}]*height:\s*100%/s);
    expect(css).toMatch(/#root\s*\{[^}]*height:\s*100vh/si);
    expect(css).toMatch(/#root\s*\{[^}]*min-height:\s*100vh/si);
  });
});
