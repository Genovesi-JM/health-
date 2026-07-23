/**
 * Canonical medical specialty codes — the single source of truth shared by the
 * booking UI, the doctor profile, and the backend queue matching
 * (Consultation.specialty == Doctor.specialization).
 *
 * Store the CODE everywhere; render the label via specialtyLabel().
 */
export const SPECIALTY_CODES = [
  'clinica_geral',
  'cardiologia',
  'dermatologia',
  'pediatria',
  'ortopedia',
  'neurologia',
  'ginecologia',
  'oftalmologia',
  'psiquiatria',
  'medicina_interna',
  'cirurgia',
  'outra',
] as const;

export type SpecialtyCode = typeof SPECIALTY_CODES[number];

/** Legacy English UI codes → canonical codes (for older stored data). */
const LEGACY_MAP: Record<string, string> = {
  general: 'clinica_geral', cardiology: 'cardiologia', dermatology: 'dermatologia',
  pediatrics: 'pediatria', orthopedics: 'ortopedia', neurology: 'neurologia',
  gynecology: 'ginecologia', ophthalmology: 'oftalmologia', psychiatry: 'psiquiatria',
  internal: 'medicina_interna', surgery: 'cirurgia', other: 'outra',
};

/** Normalise any stored specialty value to a canonical code. */
export function normalizeSpecialty(value?: string): string {
  if (!value) return '';
  const v = value.trim();
  if (LEGACY_MAP[v]) return LEGACY_MAP[v];
  // Already a canonical code, or a free-text label — lower/snake for matching.
  const snake = v.toLowerCase().replace(/\s+/g, '_');
  return LEGACY_MAP[snake] ?? snake;
}

/**
 * Human label for a specialty. Uses i18n `spec.<code>` when known; otherwise
 * prettifies the raw value so legacy/free-text data still displays sensibly.
 */
export function specialtyLabel(value: string | undefined, t: (k: string) => string): string {
  if (!value) return '';
  const code = normalizeSpecialty(value);
  const key = `spec.${code}`;
  const label = t(key);
  if (label !== key) return label;               // canonical code matched i18n
  // Fallback: title-case the original value.
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
