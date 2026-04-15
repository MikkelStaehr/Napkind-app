const ALLERGY_KEYWORDS = [
  'allergy',
  'allergi',
  'nuts',
  'nødder',
  'nodder',
  'gluten',
  'lactose',
  'laktose',
  'dairy',
  'shellfish',
  'skaldyr',
  'egg',
  'æg',
  'aeg',
  'soy',
  'soja',
  'celery',
  'selleri',
  'mustard',
  'sennep',
  'sesame',
  'sesam',
  'peanut',
  'fish',
]

export function hasAllergy(notes: string | null): boolean {
  if (!notes) return false
  const lower = notes.toLowerCase()
  return ALLERGY_KEYWORDS.some((k) => lower.includes(k))
}
