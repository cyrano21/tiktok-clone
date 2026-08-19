import { z } from 'zod';
import type { OpenMontageProductionManifest } from '@/services/openMontagePlan';

const jobStatusSchema = z.enum([
  'queued',
  'running',
  'awaiting_approval',
  'completed',
  'failed',
  'canceled',
]);

const renderSchema = z.object({
  downloadUrl: z.string().url(),
  fileName: z.string().min(1).max(240).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  durationSeconds: z.number().positive().max(3600).optional(),
  width: z.number().int().positive().max(16384).optional(),
  height: z.number().int().positive().max(16384).optional(),
});

export const openMontageExecutorJobSchema = z.object({
  jobId: z.string().min(1).max(200),
  status: jobStatusSchema,
  stage: z.string().max(120).optional(),
  progress: z.number().min(0).max(100).optional(),
  projectName: z.string().max(240).optional(),
  estimatedCostEur: z.number().min(0).max(10000).optional(),
  actualCostEur: z.number().min(0).max(10000).optional(),
  awaitingApproval: z
    .object({
      gate: z.string().max(120),
      summary: z.string().max(4000),
    })
    .optional(),
  render: renderSchema.optional(),
  error: z.string().max(4000).optional(),
  updatedAt: z.string().datetime().optional(),
});

export type OpenMontageExecutorJob = z.infer<typeof openMontageExecutorJobSchema>;

function executorBaseUrl(): string | null {
  const value = process.env.OPENMONTAGE_EXECUTOR_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

function executorHeaders(): Record<string, string> {
  const token = process.env.OPENMONTAGE_EXECUTOR_TOKEN?.trim();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function isOpenMontageExecutorConfigured(): boolean {
  return Boolean(executorBaseUrl());
}

async function readExecutorResponse(response: Response): Promise<OpenMontageExecutorJob> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: unknown }).error || '')
        : '';
    throw new Error(message || `OpenMontage executor HTTP ${response.status}`);
  }

  const parsed = openMontageExecutorJobSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('OpenMontage executor returned an invalid job payload.');
  }
  return parsed.data;
}

export async function submitOpenMontageJob(params: {
  manifest: OpenMontageProductionManifest;
  callbackBaseUrl?: string;
}): Promise<OpenMontageExecutorJob> {
  const base = executorBaseUrl();
  if (!base) throw new Error('OPENMONTAGE_EXECUTOR_URL is not configured.');

  const response = await fetch(`${base}/jobs`, {
    method: 'POST',
    headers: executorHeaders(),
    body: JSON.stringify({
      manifest: params.manifest,
      ...(params.callbackBaseUrl
        ? { callbackBaseUrl: params.callbackBaseUrl.replace(/\/$/, '') }
        : {}),
      orchestrationContract: {
        pipelineRequired: true,
        humanApprovalRequired: true,
        noSilentProviderSubstitution: true,
        returnProviderDecisions: true,
        returnActualCosts: true,
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });

  return readExecutorResponse(response);
}

export async function getOpenMontageJob(jobId: string): Promise<OpenMontageExecutorJob> {
  const base = executorBaseUrl();
  if (!base) throw new Error('OPENMONTAGE_EXECUTOR_URL is not configured.');
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(jobId)) throw new Error('Invalid OpenMontage job id.');

  const response = await fetch(`${base}/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: executorHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  return readExecutorResponse(response);
}

export async function approveOpenMontageJob(params: {
  jobId: string;
  gate: string;
  approved: boolean;
  note?: string;
}): Promise<OpenMontageExecutorJob> {
  const base = executorBaseUrl();
  if (!base) throw new Error('OPENMONTAGE_EXECUTOR_URL is not configured.');
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(params.jobId)) throw new Error('Invalid OpenMontage job id.');

  const response = await fetch(`${base}/jobs/${encodeURIComponent(params.jobId)}/approval`, {
    method: 'POST',
    headers: executorHeaders(),
    body: JSON.stringify({
      gate: params.gate.slice(0, 120),
      approved: params.approved,
      ...(params.note?.trim() ? { note: params.note.trim().slice(0, 2000) } : {}),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  return readExecutorResponse(response);
}
