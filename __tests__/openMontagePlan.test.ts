import { buildOpenMontageProductionPlan } from '@/services/openMontagePlan';

describe('OpenMontage production plan', () => {
  it('builds an original vertical production contract from a reference', () => {
    const plan = buildOpenMontageProductionPlan({
      referenceUrl: 'https://www.tiktok.com/@creator/video/1234567890',
      topic: 'Pourquoi les batteries externes solaires deviennent populaires',
      targetDurationSeconds: 45,
      budgetEur: 2,
      product: {
        id: 'product-1',
        title: 'Power bank solaire',
        url: 'https://orchidy.fr/product/power-bank-solaire',
      },
    });

    expect(plan.schemaVersion).toBe('orky.openmontage.production-plan.v1');
    expect(plan.brief.aspectRatio).toBe('9:16');
    expect(plan.production.targetPlatforms).toContain('orky');
    expect(plan.source.referencePolicy).toBe('inspiration-only');
    expect(plan.rights.doNotCloneCreatorIdentity).toBe(true);
    expect(plan.commerce?.rule).toBe('show-product-without-inventing-price-stock-or-claims');
    expect(plan.integration.mode).toBe('external-openmontage-workspace');
    expect(plan.openMontagePrompt).toContain('Ne copie ni l\'identité du créateur');
    expect(plan.openMontagePrompt).toContain('2.00 EUR');
  });

  it('rejects unsafe or nonsensical plan inputs at the schema boundary', () => {
    expect(() =>
      buildOpenMontageProductionPlan({
        topic: 'x',
        targetDurationSeconds: 3,
      }),
    ).toThrow();
  });
});
