import type { AbilityId, CharacterRecord } from '../types'

const STORAGE_KEY = 'the-severance.characters.v1'
const DEFAULT_LEVEL = 5

const ABILITY_IDS: AbilityId[] = [
  'strength',
  'agility',
  'resilience',
  'intellect',
  'personality',
  'arcana',
]

const createBaseAbilities = (): Record<AbilityId, number> => ({
  strength: 5,
  agility: 5,
  resilience: 5,
  intellect: 5,
  personality: 5,
  arcana: 5,
})

export const createCharacter = (name = 'New Character'): CharacterRecord => {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    name,
    concept: '',
    raceId: null,
    classId: null,
    level: DEFAULT_LEVEL,
    baseAbilityScores: createBaseAbilities(),
    selectedSkillIds: [],
    selectedTalentIds: [],
    customTalents: [],
    selectedSpellIds: [],
    customSpells: [],
    equippedWeaponId: 'unarmed',
    equippedArmorId: null,
    inventory: [],
    overrides: {
      attackRating: [],
      defenseRating: [],
      maxHp: [],
    },
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

const isCharacterRecord = (value: unknown): value is CharacterRecord => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<CharacterRecord>

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.level === 'number' &&
    typeof candidate.baseAbilityScores === 'object' &&
    ABILITY_IDS.every((ability) => typeof candidate.baseAbilityScores?.[ability] === 'number') &&
    Array.isArray(candidate.selectedSkillIds) &&
    Array.isArray(candidate.selectedTalentIds) &&
    Array.isArray(candidate.customTalents) &&
    Array.isArray(candidate.selectedSpellIds) &&
    Array.isArray(candidate.customSpells) &&
    Array.isArray(candidate.inventory) &&
    typeof candidate.overrides === 'object' &&
    typeof candidate.notes === 'string'
  )
}

export const loadCharacters = (): CharacterRecord[] => {
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return [createCharacter('Expedition Sheet')]
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return [createCharacter('Expedition Sheet')]
    }

    const characters = parsed.filter(isCharacterRecord)
    return characters.length > 0 ? characters : [createCharacter('Expedition Sheet')]
  } catch {
    return [createCharacter('Expedition Sheet')]
  }
}

export const saveCharacters = (characters: CharacterRecord[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(characters))
}

export const touchCharacter = (character: CharacterRecord): CharacterRecord => ({
  ...character,
  updatedAt: new Date().toISOString(),
})
