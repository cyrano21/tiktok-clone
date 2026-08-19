import { z } from 'zod';

export const openMontagePlanInputSchema = z.object({
  referenceUrl: z.string().url().optional(),
  topic: z.string().trim().min(3).max(500),
  objective: z.string().trim().min(3).max(1000).default('Créer une vidéo verticale originale et publiable dans ORKY.'),
  targetDurationSeconds: z.number().int().min(10).max(600).default(60),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16'),
  language: z.string().trim().min(2).max(12).default('fr'),
  tone: z.string().trim().min(2).max(120).default('clair, dynamique, crédible'),
  budgetEur: z.number().min(0).max(1000).default(0),
  useRealFootageOnly: z.boolean().default(false),
  includeNarration: z.boolean().default(true),
  includeCaptions: z.boolean().default(true),
  product: z
    .object({
      id: z.string().trim().min(1).max(200).optional(),
      title: z.string().trim().min(1).max(300),
      url: z.string().url().optional(),
    })
    .optional(),
});

export type OpenMontagePlanInput = z.input<typeof openMontagePlanInputSchema>;
export type ParsedOpenMontagePlanInput = z.output<typeof openMontagePlanInputSchema>;

export type OpenMontageProductionManifest = {
  schemaVersion: 'orky.openmontage.production-plan.v1';
  producer: 'ORKY';
  source: {
    referenceUrl?: string;
    referencePolicy: 'inspiration-only';
  };
  brief: {
    topic: string;
    objective: string;
    language: string;
    tone: string;
    targetDurationSeconds: number;
    aspectRatio: '9:16' | '1:1' | '16:9';
    budgetEur: number;
  };
  production: {
    useRealFootageOnly: boolean;
    includeNarration: boolean;
    includeCaptions: boolean;
    targetPlatforms: ['orky', 'tiktok', 'reels', 'youtube-shorts'];
    requiredGates: ['concept', 'script', 'storyboard', 'rights', 'final-qc'];
  };
  commerce?: {
    productId?: string;
    title: string;
    url?: string;
    rule: 'show-product-without-inventing-price-stock-or-claims';
  };
  rights: {
    doNotCloneCreatorIdentity: true;
    doNotReuseUnlicensedMedia: true;
    referenceIsStyleSignalOnly: true;
  };
  integration: {
    mode: 'external-openmontage-workspace';
    reason: string;
  };
  openMontagePrompt: string;
};

function compactLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function buildOpenMontageProductionPlan(
  rawInput: OpenMontagePlanInput,
): OpenMontageProductionManifest {
  const input = openMontagePlanInputSchema.parse(rawInput);

  const referenceInstruction = input.referenceUrl
    ? `Analyse cette vidéo comme référence de rythme, hook, structure et langage visuel : ${input.referenceUrl}. Ne copie ni l'identité du créateur, ni ses médias, ni une œuvre protégée.`
    : 'Pars du brief sans reproduire l’identité ou les médias d’un créateur tiers.';

  const mediaInstruction = input.useRealFootageOnly
    ? 'Utilise uniquement des séquences réelles dont les droits/licences sont compatibles avec la publication.'
    : 'Choisis honnêtement entre footage licencié/ouvert et génération visuelle selon la qualité, le coût et les droits.';

  const productInstruction = input.product
    ? `Le contenu peut présenter le produit « ${input.product.title} », mais ne doit jamais inventer prix, stock, disponibilité, avis ou promesse commerciale.`
    : '';

  const prompt = [
    `Crée une production vidéo originale de ${input.targetDurationSeconds}s au format ${input.aspectRatio}, en ${input.language}.`,
    `Sujet : ${compactLine(input.topic)}.`,
    `Objectif : ${compactLine(input.objective)}.`,
    `Ton : ${compactLine(input.tone)}.`,
    referenceInstruction,
    mediaInstruction,
    input.includeNarration ? 'Prévois une narration naturelle et synchronisée.' : 'Pas de narration.',
    input.includeCaptions ? 'Ajoute des sous-titres lisibles et synchronisés.' : 'Pas de sous-titres imposés.',
    `Budget de génération maximal : ${input.budgetEur.toFixed(2)} EUR. Donne le coût estimé avant les générations payantes.`,
    productInstruction,
    'Fais valider concept, script, storyboard, droits puis rendu final. Retourne les décisions de providers et les coûts réels.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    schemaVersion: 'orky.openmontage.production-plan.v1',
    producer: 'ORKY',
    source: {
      ...(input.referenceUrl ? { referenceUrl: input.referenceUrl } : {}),
      referencePolicy: 'inspiration-only',
    },
    brief: {
      topic: input.topic,
      objective: input.objective,
      language: input.language,
      tone: input.tone,
      targetDurationSeconds: input.targetDurationSeconds,
      aspectRatio: input.aspectRatio,
      budgetEur: input.budgetEur,
    },
    production: {
      useRealFootageOnly: input.useRealFootageOnly,
      includeNarration: input.includeNarration,
      includeCaptions: input.includeCaptions,
      targetPlatforms: ['orky', 'tiktok', 'reels', 'youtube-shorts'],
      requiredGates: ['concept', 'script', 'storyboard', 'rights', 'final-qc'],
    },
    ...(input.product
      ? {
          commerce: {
            ...(input.product.id ? { productId: input.product.id } : {}),
            title: input.product.title,
            ...(input.product.url ? { url: input.product.url } : {}),
            rule: 'show-product-without-inventing-price-stock-or-claims' as const,
          },
        }
      : {}),
    rights: {
      doNotCloneCreatorIdentity: true,
      doNotReuseUnlicensedMedia: true,
      referenceIsStyleSignalOnly: true,
    },
    integration: {
      mode: 'external-openmontage-workspace',
      reason:
        'OpenMontage is kept outside the ORKY runtime/licence boundary. ORKY exports a versioned production contract instead of vendoring the AGPL application.',
    },
    openMontagePrompt: prompt,
  };
}
