# ORKY → OpenMontage production contract

## Goal

ORKY can turn a trend, product, topic or reference video into a **versioned production brief** and hand it to an external agentic executor that operates a real OpenMontage workspace.

The integration intentionally does not vendor OpenMontage into ORKY. OpenMontage is AGPLv3 and is itself a complete agentic production environment. ORKY keeps a clean application/licence boundary and exchanges versioned job data instead.

## Planning endpoint

```text
POST /api/studio/openmontage-plan
```

Example body:

```json
{
  "referenceUrl": "https://www.tiktok.com/@creator/video/123",
  "topic": "3 erreurs qui détruisent la batterie de ton téléphone",
  "objective": "Créer un Short éducatif original pour ORKY",
  "targetDurationSeconds": 45,
  "aspectRatio": "9:16",
  "language": "fr",
  "tone": "direct, pédagogique, moderne",
  "budgetEur": 2,
  "useRealFootageOnly": false,
  "includeNarration": true,
  "includeCaptions": true
}
```

The response contains `orky.openmontage.production-plan.v1` plus a ready-to-use `openMontagePrompt`.

## Execution endpoints

The executable path is authenticated and does **not** expose the raw executor job id to the client.

```text
POST /api/studio/openmontage-execute
GET  /api/studio/openmontage-execute/:signedHandle
POST /api/studio/openmontage-execute/:signedHandle/approval
```

The Next.js boundary validates the current ORKY bearer session against the canonical backend before any executor call. A submitted executor `jobId` is wrapped in a seven-day HMAC-signed handle containing the ORKY user id. Status and approval endpoints accept the handle only when its signature is valid, it has not expired, and it belongs to the authenticated user.

Required web-runtime configuration:

```env
OPENMONTAGE_EXECUTOR_URL=http://openmontage-executor:8787
OPENMONTAGE_EXECUTOR_TOKEN=replace-with-private-service-token
OPENMONTAGE_JOB_HANDLE_SECRET=replace-with-a-separate-long-random-secret
```

`OPENMONTAGE_JOB_HANDLE_SECRET` can technically fall back to the executor token, but production should use a separate secret so service authentication and client-handle signing have independent rotation boundaries.

## Executor contract

`OPENMONTAGE_EXECUTOR_URL` is **not** assumed to be an official OpenMontage REST API. It is an ORKY-side adapter contract for a service that actually runs an OpenMontage-capable agent.

ORKY expects:

```text
POST /jobs
GET  /jobs/:jobId
POST /jobs/:jobId/approval
```

A job can be:

- `queued`;
- `running`;
- `awaiting_approval`;
- `completed`;
- `failed`;
- `canceled`.

When submitting, ORKY explicitly requires the executor to preserve these orchestration rules:

- production goes through a pipeline;
- human approvals remain active;
- no silent provider/model substitution;
- provider decisions are returned;
- actual costs are returned.

This mirrors OpenMontage's agent contract instead of pretending that OpenMontage is a one-shot renderer.

## ORKY Studio flow

`studio.production` exposes the feature from ORKY Studio:

1. enter topic/reference/objective/duration/budget;
2. submit the production contract;
3. retain the signed active handle in local application storage;
4. poll the real executor while the job is queued/running;
5. stop at an executor approval gate and show its summary;
6. approve or reject explicitly;
7. expose the final render URL only after the executor reports `completed` with a real render.

If the executor is not configured, ORKY returns an explicit `503`; the UI does not fabricate a job or video.

The current client execution UI is intentionally web-only because the `/api/studio/*` security boundary is a same-origin Next.js route. Native execution should later use a dedicated authenticated backend endpoint rather than guessing a web origin.

## Reference-video rule

A TikTok/Reel/Short reference is treated as a **style signal only**:

- pacing;
- hook structure;
- narrative rhythm;
- visual language.

It must not become permission to copy the creator identity, reuse unlicensed media or reproduce a protected work substantially.

## Commerce rule

When a production is linked to an Orchidy product, the manifest may carry product identity and URL. It explicitly forbids invented price, stock, reviews, availability or product claims. Commerce facts must be revalidated from the authoritative marketplace/supplier data before publication.

## Production gates

Every generated contract requires:

1. concept;
2. script;
3. storyboard;
4. rights/licence review;
5. final QC.

Generated media does not silently become canonical/published ORKY content.

## Deliberate boundary

This branch implements the ORKY side completely up to the executor boundary. It does **not** claim that an OpenMontage production can run until an external executor implementing the contract above is deployed and configured.
