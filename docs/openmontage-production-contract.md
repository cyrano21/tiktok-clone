# ORKY → OpenMontage production contract

## Goal

ORKY can turn a trend, product, topic or reference video into a **versioned production brief** that an external OpenMontage workspace can execute.

The integration intentionally does not vendor OpenMontage into ORKY. OpenMontage is AGPLv3 and is itself a complete agentic production environment. ORKY keeps a clean application/licence boundary and exports data instead.

## Endpoint

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

## Reference-video rule

A TikTok/Reel/Short reference is treated as a **style signal only**:

- pacing;
- hook structure;
- narrative rhythm;
- visual language.

It must not become permission to copy the creator identity, reuse unlicensed media or reproduce a protected work substantially.

## Commerce rule

When a production is linked to an Orchidy product, the manifest may carry product identity and URL. It explicitly forbids invented price, stock, reviews, availability or product claims. Commerce facts must be revalidated from the authoritative marketplace/fupplier data before publication.

## Production gates

Every generated contract requires:

1. concept;
2. script;
3. storyboard;
4. rights/licence review;
5. final QC.

This matches ORKY's principle that generated media does not silently become canonical/published content.

## Future execution adapter

A later worker can consume the manifest and invoke an OpenMontage workspace/agent. That worker should remain isolated from the ORKY runtime and should return only produced assets, provider decisions, costs and rights metadata.

Until that worker exists, this branch implements the stable contract boundary rather than pretending an external production has run.
