import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('ORKY OpenMontage execution boundary', () => {
  it('requires an agentic executor instead of pretending OpenMontage is a one-shot API', () => {
    const executor = read('src/server/openmontage/executor.ts');

    expect(executor).toContain('OPENMONTAGE_EXECUTOR_URL');
    expect(executor).toContain('pipelineRequired: true');
    expect(executor).toContain('humanApprovalRequired: true');
    expect(executor).toContain('noSilentProviderSubstitution: true');
    expect(executor).toContain('/approval');
  });

  it('binds executor job ids to authenticated ORKY users through signed handles', () => {
    const studioServer = read('app/api/studio/_server.ts');
    const submitRoute = read('app/api/studio/openmontage-execute/route.ts');
    const statusRoute = read('app/api/studio/openmontage-execute/[handle]/route.ts');

    expect(studioServer).toContain("createHmac('sha256'");
    expect(studioServer).toContain('timingSafeEqual');
    expect(studioServer).toContain('expectedUserId');
    expect(studioServer).toContain('/v1/auth/me');
    expect(submitRoute).toContain('createOpenMontageJobHandle');
    expect(statusRoute).toContain('verifyOpenMontageJobHandle');
    expect(submitRoute).toContain('jobId: _jobId');
  });

  it('surfaces a real Studio production workspace with polling and approval gates', () => {
    const screen = read('src/screens/studio/OpenMontageProductionScreen.tsx');
    const registry = read('src/navigation/screenRegistry.tsx');
    const hub = read('src/screens/studio/StudioHubScreen.tsx');

    expect(screen).toContain('startOpenMontageProduction');
    expect(screen).toContain('getOpenMontageProduction');
    expect(screen).toContain('decideOpenMontageGate');
    expect(screen).toContain('setInterval');
    expect(screen).toContain('awaitingApproval');
    expect(screen).toContain('render.downloadUrl');
    expect(registry).toContain("'studio.production': OpenMontageProductionScreen");
    expect(hub).toContain("label: 'Production IA'");
  });
});
