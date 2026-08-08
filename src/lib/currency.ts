// Code devise canonique. L'app accepte "FC" (libellé utilisateur) mais toutes
// les écritures / calculs utilisent le code ISO "CDF". Cette normalisation évite
// que le capital initial inscrit à la création de l'église soit perdu.
export function normalizeCurrencyCode(c?: string | null): string {
  const u = (c ?? 'USD').trim().toUpperCase()
  if (u === 'FC' || u === 'FCFA') return 'CDF'
  return u
}

// Symbole lisible pour l'utilisateur.
export function currencySymbol(code?: string | null): string {
  const n = normalizeCurrencyCode(code)
  if (n === 'USD') return '$'
  if (n === 'EUR') return '€'
  if (n === 'CDF') return 'FC'
  return n
}

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'CDF'] as const