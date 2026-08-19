import { lexicalScore } from './product-match.routes';

describe('product-match candidate scoring', () => {
  it('scores identical titles at 1', () => {
    expect(lexicalScore('lampe sunset projection', { title: 'Lampe Sunset Projection' })).toBe(1);
  });

  it('scores a full match above a partial one', () => {
    const exact = lexicalScore('lampe sunset projection', { title: 'Lampe Sunset Projection LED' });
    const partial = lexicalScore('lampe sunset projection', { title: 'Casque audio bluetooth' });
    expect(exact).toBeGreaterThan(partial);
    expect(partial).toBe(0);
  });

  it('handles accents and punctuation', () => {
    expect(lexicalScore('créme hydratante visage', { title: 'Crème hydratante visage 50ml' })).toBeGreaterThan(0.5);
  });

  it('returns 0 when tokens do not overlap', () => {
    expect(lexicalScore('robot aspirateur', { title: 'Tapis de bain' })).toBe(0);
  });

  it('boosts score when category matches', () => {
    const withCat = lexicalScore('lampe retro', { title: 'Lampe', category: 'Retro Lighting' });
    const noCat = lexicalScore('lampe retro', { title: 'Lampe', category: 'Kitchen' });
    expect(withCat).toBeGreaterThan(noCat);
  });

  it('boosts score when description keywords match', () => {
    const withDesc = lexicalScore('enceinte jbl bluetooth', {
      title: 'Enceinte Portable',
      description: 'JBL bluetooth speakers haute qualité',
    });
    const noDesc = lexicalScore('enceinte jbl bluetooth', {
      title: 'Enceinte Portable',
      description: 'Petit appareil pour la cuisine',
    });
    expect(withDesc).toBeGreaterThan(noDesc);
  });
});
