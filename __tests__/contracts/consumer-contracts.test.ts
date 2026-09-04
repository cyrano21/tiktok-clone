/**
 * Consumer contract tests — ORKY (Lot 1 PLAN-ORCHIDS).
 *
 * Gate : « le receipt créé par Orchidy doit être accepté par ORKY » et
 * « la fixture ORKY doit être acceptée par Orchidy Pro » (validé ici côté émetteur).
 * Source de vérité : src/contracts/v1 (copie synchronisée).
 */
import { validateContract, type SchemaMap } from '../../src/contracts/v1/validate-json-schema';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CONTRACTS_DIR = path.join(process.cwd(), 'src', 'contracts', 'v1');

function loadSchemas(): SchemaMap {
  const schemas: SchemaMap = {};
  for (const file of fs.readdirSync(CONTRACTS_DIR)) {
    if (file.endsWith('.schema.json')) {
      schemas[file] = JSON.parse(fs.readFileSync(path.join(CONTRACTS_DIR, file), 'utf-8'));
    }
  }
  return schemas;
}

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(CONTRACTS_DIR, 'fixtures', name), 'utf-8'));
}

const SCHEMAS = loadSchemas();

describe('Consumer contract tests — ORKY (consommateur Orchidy + Pro)', () => {
  it('accepte le receipt produit par Orchidy', () => {
    const issues = validateContract('orky-checkout-receipt-v1.schema.json', loadFixture('orky-checkout-receipt-v1.fixture.json'), SCHEMAS);
    expect(issues).toEqual([]);
  });

  it('accepte le candidat fournisseur produit par Orchidy Pro', () => {
    const issues = validateContract('supplier-candidate-v1.schema.json', loadFixture('supplier-candidate-v1.fixture.json'), SCHEMAS);
    expect(issues).toEqual([]);
  });

  it('accepte la conversion produite par Orchidy Pro', () => {
    const issues = validateContract('viral-conversion-v1.schema.json', loadFixture('viral-conversion-v1.fixture.json'), SCHEMAS);
    expect(issues).toEqual([]);
  });

  it('accepte la vidéo générée produite par Orchidy Pro', () => {
    const issues = validateContract('generated-commerce-video-v1.schema.json', loadFixture('generated-commerce-video-v1.fixture.json'), SCHEMAS);
    expect(issues).toEqual([]);
  });

  it('émet un signal viral et une requête de sourcing valides (consommés par Pro)', () => {
    expect(validateContract('orky-trend-signal-v1.schema.json', loadFixture('orky-trend-signal-v1.fixture.json'), SCHEMAS)).toEqual([]);
    expect(validateContract('viral-sourcing-request-v1.schema.json', loadFixture('viral-sourcing-request-v1.fixture.json'), SCHEMAS)).toEqual([]);
  });

  it('émet un lien vidéo valide (consommé par Pro)', () => {
    const issues = validateContract('orky-video-link-v1.schema.json', loadFixture('orky-video-link-v1.fixture.json'), SCHEMAS);
    expect(issues).toEqual([]);
  });

  it('rejette un receipt expiré/signé hors format', () => {
    const broken = loadFixture('orky-checkout-receipt-v1.fixture.json') as Record<string, unknown>;
    broken.signature = 'court';
    const issues = validateContract('orky-checkout-receipt-v1.schema.json', broken, SCHEMAS);
    expect(issues.some((i) => i.message.includes('longueur'))).toBe(true);
  });
});