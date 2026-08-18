import { lexicalScore } from './product-match.routes';

describe('product-match candidate scoring', () => {
  it('scores identical titles at 1', () => {
    expect(lexicalScore('lampe sunset projection', 'Lampe Sunset Projection')).toBe(1);
  });

  it('scores a full match above a partial one', () => {
    const exact = lexicalScore('lampe sunset projection', 'Lampe Sunset Projection LED');
    const partial = lexicalScore('lampe sunset projection', 'Casque audio bluetooth');
    expect(exact).toBeGreaterThan(partial);
    expect(partial).toBe(0);
  });

  it('handles accents and punctuation', () => {
    expect(lexicalScore('créme hydratante visage', 'Crème hydratante visage 50ml')).toBeGreaterThan(0.5);
  });

  it('returns 0 when tokens do not overlap', () => {
    expect(lexicalScore('robot aspirateur', 'Tapis de bain')).toBe(0);
  });
});
