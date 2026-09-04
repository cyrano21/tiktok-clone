/**
 * Validateur JSON Schema (sous-ensemble draft-07) — zéro dépendance.
 *
 * Supporte : type (simple ou tableau), required, properties, additionalProperties,
 * items, minItems/maxItems, minProperties/maxProperties, enum, pattern,
 * minLength/maxLength, minimum/maximum, format "date-time" (léger) et $ref
 * résolu par nom de fichier dans le même dossier (ex: "orky-trend-signal-v1.schema.json").
 *
 * Utilisé par les consumer contract tests (PLAN-ORCHIDS Lot 1) et, à terme,
 * par les validations runtime des routes inter-apps.
 */

export type JsonSchema = {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  enum?: unknown[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  $ref?: string;
  format?: string;
};

export type SchemaMap = Record<string, JsonSchema>;

export type ValidationIssue = { path: string; message: string };

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

function refKey(ref: string): string {
  // "orky-trend-signal-v1.schema.json" -> "orky-trend-signal-v1.schema.json"
  return ref.replace(/^\.\//, '');
}

function resolve(schema: JsonSchema, schemas: SchemaMap): JsonSchema {
  if (!schema.$ref) return schema;
  const key = refKey(schema.$ref);
  const found = schemas[key] ?? schemas[key.replace('.schema.json', '')];
  if (!found) return schema; // ref non résolue : laissée telle quelle (le test échouera si champs requis absents)
  return found;
}

function typeMatches(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function checkFormat(value: unknown, format: string | undefined, path: string, issues: ValidationIssue[]): void {
  if (!format || typeof value !== 'string') return;
  if (format === 'date-time' && !DATE_TIME_RE.test(value)) {
    issues.push({ path, message: `format date-time invalide: "${value}"` });
  }
}

function checkString(value: unknown, schema: JsonSchema, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'string') return;
  if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
    issues.push({ path, message: `ne matche pas le pattern ${schema.pattern}` });
  }
  if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
    issues.push({ path, message: `longueur < ${schema.minLength}` });
  }
  if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
    issues.push({ path, message: `longueur > ${schema.maxLength}` });
  }
  checkFormat(value, schema.format, path, issues);
}

function checkNumber(value: unknown, schema: JsonSchema, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'number') return;
  if (typeof schema.minimum === 'number' && value < schema.minimum) {
    issues.push({ path, message: `valeur < minimum ${schema.minimum}` });
  }
  if (typeof schema.maximum === 'number' && value > schema.maximum) {
    issues.push({ path, message: `valeur > maximum ${schema.maximum}` });
  }
}

function checkArray(value: unknown, schema: JsonSchema, path: string, issues: ValidationIssue[], schemas: SchemaMap): void {
  if (!Array.isArray(value)) return;
  if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
    issues.push({ path, message: `minItems ${schema.minItems} violé (${value.length})` });
  }
  if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
    issues.push({ path, message: `maxItems ${schema.maxItems} violé (${value.length})` });
  }
  if (schema.items) {
    const itemSchema = resolve(schema.items, schemas);
    value.forEach((item, i) => validateValue(item, itemSchema, `${path}[${i}]`, issues, schemas));
  }
}

function checkObject(value: Record<string, unknown>, schema: JsonSchema, path: string, issues: ValidationIssue[], schemas: SchemaMap): void {
  const keys = Object.keys(value);
  if (typeof schema.minProperties === 'number' && keys.length < schema.minProperties) {
    issues.push({ path, message: `minProperties ${schema.minProperties} violé (${keys.length})` });
  }
  if (typeof schema.maxProperties === 'number' && keys.length > schema.maxProperties) {
    issues.push({ path, message: `maxProperties ${schema.maxProperties} violé (${keys.length})` });
  }
  for (const required of schema.required ?? []) {
    if (!(required in value)) {
      issues.push({ path, message: `champ requis manquant: ${required}` });
    }
  }
  for (const [key, raw] of Object.entries(value)) {
    const propertySchema = schema.properties?.[key];
    if (propertySchema) {
      validateValue(raw, resolve(propertySchema, schemas), `${path}.${key}`, issues, schemas);
    } else if (schema.additionalProperties === false) {
      issues.push({ path, message: `propriété non autorisée: ${key}` });
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      validateValue(raw, resolve(schema.additionalProperties, schemas), `${path}.${key}`, issues, schemas);
    }
  }
}

export function validateValue(
  value: unknown,
  rawSchema: JsonSchema,
  path: string,
  issues: ValidationIssue[],
  schemas: SchemaMap = {},
): void {
  const schema = resolve(rawSchema, schemas);

  if (schema.enum !== undefined) {
    if (!schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) {
      issues.push({ path, message: `valeur hors enum: ${JSON.stringify(value)}` });
      return;
    }
  }

  const types = typeof schema.type === 'string' ? [schema.type] : schema.type ?? [];
  if (types.length > 0) {
    const ok = types.some((t) => typeMatches(value, t));
    if (!ok) {
      issues.push({ path, message: `type attendu ${types.join('|')}, reçu ${value === null ? 'null' : typeof value}` });
      return;
    }
  }

  if (typeof value === 'string') checkString(value, schema, path, issues);
  if (typeof value === 'number') checkNumber(value, schema, path, issues);
  if (Array.isArray(value)) checkArray(value, schema, path, issues, schemas);
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    checkObject(value as Record<string, unknown>, schema, path, issues, schemas);
  }
}

/** Valide `value` contre le schéma `contractKey` (clé = nom de fichier, ex: "orky-trend-signal-v1.schema.json"). */
export function validateContract(contractKey: string, value: unknown, schemas: SchemaMap): ValidationIssue[] {
  const schema = schemas[contractKey] ?? schemas[contractKey.replace('.schema.json', '')];
  if (!schema) return [{ path: '$', message: `contrat inconnu: ${contractKey}` }];
  const issues: ValidationIssue[] = [];
  validateValue(value, schema, '$', issues, schemas);
  return issues;
}