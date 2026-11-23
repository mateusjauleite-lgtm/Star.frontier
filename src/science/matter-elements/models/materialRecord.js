import { MATTER_CATEGORIES, MATTER_STATES } from '../constants.js';

const VALID_CATEGORIES = new Set(Object.values(MATTER_CATEGORIES));
const VALID_STATES = new Set(MATTER_STATES);

export function validateMaterialRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') return ['Record must be an object'];
  if (typeof record.id !== 'string' || !record.id.trim()) errors.push('id is required');
  if (typeof record.name !== 'string' || !record.name.trim()) errors.push('name is required');
  if (!VALID_CATEGORIES.has(record.category)) errors.push('category is invalid');
  if (record.state != null && !VALID_STATES.has(record.state)) errors.push('state is invalid');
  if (record.composition != null && !Array.isArray(record.composition)) errors.push('composition must be an array');
  if (record.composition?.some((part) => !part || typeof part.elementId !== 'string' || !Number.isFinite(part.fraction) || part.fraction < 0)) {
    errors.push('composition entries require elementId and a non-negative fraction');
  }
  if (record.relatedIds != null && !Array.isArray(record.relatedIds)) errors.push('relatedIds must be an array');
  return errors;
}

export function createMaterialRecord(record) {
  const errors = validateMaterialRecord(record);
  if (errors.length) {
    throw new TypeError(`Invalid matter record: ${errors.join('; ')}`);
  }
  return Object.freeze({
    ...record,
    composition: Object.freeze((record.composition ?? []).map((part) => Object.freeze({ ...part }))),
    relatedIds: Object.freeze([...(record.relatedIds ?? [])]),
    tags: Object.freeze([...(record.tags ?? [])]),
    properties: Object.freeze({ ...(record.properties ?? {}) }),
  });
}
