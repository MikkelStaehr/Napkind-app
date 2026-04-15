const ALLERGY_KEYWORDS = [
  'allergi',
  'nødder',
  'nodder',
  'gluten',
  'laktose',
  'skaldyr',
  'æg',
  'aeg',
  'soja',
  'selleri',
  'sennep',
  'sesam',
]

export function hasAllergy(notes: string | null): boolean {
  if (!notes) return false
  const lower = notes.toLowerCase()
  return ALLERGY_KEYWORDS.some((k) => lower.includes(k))
}
