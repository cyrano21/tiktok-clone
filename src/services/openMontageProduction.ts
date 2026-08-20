import { Platform } from 'react-native';
import { apiClient } from './api';

export type OpenMontageProductionStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'canceled';

export type OpenMontageProduction = {
  handle: string;
  status: OpenMontageProductionStatus;
  stage?: string;
  progress?: number;
  projectName?: string;
  estimatedCostEur?: number;
  actualCostEur?: number;
  awaitingApproval?: {
    gate: string;
    summary: string;
  };
  render?: {
    downloadUrl: string;
    fileName?: string;
    sha256?: string;
    durationSeconds?: number;
    width?: number;
    height?: number;
  };
  error?: string;
  updatedAt?: string;
};

export type OpenMontageBrief = {
  referenceUrl?: string;
  topic: string;
  objective?: string;
  targetDurationSeconds?: number;
  aspectRatio?: '9:16' | '1:1' | '16:9';
  language?: string;
  tone?: string;
  budgetEur?: number;
  useRealFootageOnly?: boolean;
  includeNarration?: boolean;
  includeCaptions?: boolean;
  product?: {
    id?: string;
    title: string;
    url?: string;
  };
};

async function studioRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (Platform.OS !== 'web') {
    throw new Error('La production OpenMontage est actuellement disponible depuis ORKY Web uniquement.');
  }

  const token = await apiClient.currentAccessToken();
  if (!token) throw new Error('Connectez-vous à ORKY avant de lancer une production.');

  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Erreur HTTP ${response.status}`);
  }
  return payload as T;
}

export async function startOpenMontageProduction(
  brief: OpenMontageBrief,
): Promise<OpenMontageProduction> {
  const payload = await studioRequest<{ production: OpenMontageProduction }>(
    '/api/studio/openmontage-execute',
    {
      method: 'POST',
      body: JSON.stringify(brief),
    },
  );
  return payload.production;
}

export async function getOpenMontageProduction(
  handle: string,
): Promise<OpenMontageProduction> {
  const payload = await studioRequest<{ production: OpenMontageProduction }>(
    `/api/studio/openmontage-execute/${encodeURIComponent(handle)}`,
  );
  return payload.production;
}

export async function decideOpenMontageGate(params: {
  handle: string;
  gate: string;
  approved: boolean;
  note?: string;
}): Promise<OpenMontageProduction> {
  const payload = await studioRequest<{ production: OpenMontageProduction }>(
    `/api/studio/openmontage-execute/${encodeURIComponent(params.handle)}/approval`,
    {
      method: 'POST',
      body: JSON.stringify({
        gate: params.gate,
        approved: params.approved,
        ...(params.note?.trim() ? { note: params.note.trim() } : {}),
      }),
    },
  );
  return payload.production;
}

export async function createOpenMontageRenderLink(handle: string): Promise<string> {
  const payload = await studioRequest<{ url: string }>(
    `/api/studio/openmontage-execute/${encodeURIComponent(handle)}/render-link`,
    { method: 'POST' },
  );
  if (!payload.url || !/^https?:\/\//i.test(payload.url)) {
    throw new Error('ORKY n’a pas reçu de lien de rendu valide.');
  }
  return payload.url;
}
