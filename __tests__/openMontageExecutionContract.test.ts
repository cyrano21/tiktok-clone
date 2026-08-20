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

  it('ships a persistent OpenMontage worker instead of a placeholder HTTP contract', () => {
    const worker = read('services/openmontage-executor/server.py');
    const dockerfile = read('services/openmontage-executor/Dockerfile');
    const compose = read('docker-compose.prod.yml');

    expect(worker).toContain('ThreadingHTTPServer');
    expect(worker).toContain('recover_jobs()');
    expect(worker).toContain('awaiting_approval');
    expect(worker).toContain('renderPath');
    expect(worker).toContain('subprocess.Popen');
    expect(worker).toContain('shell=False').or;
    expect(dockerfile).toContain('1bab711820828c2e5fc1f87ed274a32587cb048f');
    expect(dockerfile).toContain('@openai/codex');
    expect(compose).toContain("profiles: ['openmontage']");
    expect(compose).toContain('openmontage_executor_data');
  });

  it('keeps executor secrets and internal render URLs out of the browser', () => {
    const statusRoute = read('app/api/studio/openmontage-execute/[handle]/route.ts');
    const renderRoute = read('app/api/studio/openmontage-execute/[handle]/render/route.ts');
    const renderLinkRoute = read('app/api/studio/openmontage-execute/[handle]/render-link/route.ts');
    const studioServer = read('app/api/studio/_server.ts');

    expect(statusRoute).toContain('createOpenMontageRenderToken');
    expect(statusRoute).not.toContain('OPENMONTAGE_EXECUTOR_TOKEN');
    expect(renderRoute).toContain('getOpenMontageRenderResponse');
    expect(renderRoute).toContain("request.headers.get('range')");
    expect(renderRoute).toContain('verifyOpenMontageRenderToken');
    expect(renderLinkRoute).toContain('expiresInSeconds: 600');
    expect(studioServer).toContain('RENDER_TOKEN_TTL_MS');
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
