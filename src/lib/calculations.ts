import type {
  AbilityId,
  Catalog,
  CharacterClass,
  CharacterRecord,
  EquipmentItem,
  OverrideEntry,
  Spell,
} from '../types'

export const abilityOrder: AbilityId[] = [
  'strength',
  'agility',
  'resilience',
  'intellect',
  'personality',
  'arcana',
]

export const abilityLabels: Record<AbilityId, string> = {
  strength: 'Strength',
  agility: 'Agility',
  resilience: 'Resilience',
  intellect: 'Intellect',
  personality: 'Personality',
  arcana: 'Arcana',
}

export const getClassById = (catalog: Catalog, classId: string | null) =>
  catalog.classes.find((entry) => entry.id === classId) ?? null

export const getRaceById = (catalog: Catalog, raceId: string | null) =>
  catalog.races.find((entry) => entry.id === raceId) ?? null

export const getEquipmentById = (catalog: Catalog, equipmentId: string | null) =>
  catalog.equipment.find((entry) => entry.id === equipmentId) ?? null

export const getAbilityModifier = (score: number) => {
  if (score <= 7) {
    return 0
  }

  return score - 7
}

export const getClassAbilityBonus = (
  abilityId: AbilityId,
  characterClass: CharacterClass | null,
) => (characterClass?.classAbilityBonus === abilityId ? 1 : 0)

export const getAbilityScore = (
  character: CharacterRecord,
  abilityId: AbilityId,
  characterClass: CharacterClass | null,
) => character.baseAbilityScores[abilityId] + getClassAbilityBonus(abilityId, characterClass)

const totalOverrides = (entries: OverrideEntry[]) =>
  entries.reduce((sum, entry) => sum + entry.value, 0)

const isCasterClass = (characterClass: CharacterClass | null) =>
  ['order-of-the-aether', 'null-adept', 'sacrist-knight'].includes(characterClass?.id ?? '')

export interface DerivedCharacter {
  classEntry: CharacterClass | null
  raceEntry: ReturnType<typeof getRaceById>
  weapon: EquipmentItem | null
  armor: EquipmentItem | null
  abilityScores: Record<AbilityId, number>
  abilityModifiers: Record<AbilityId, number>
  pointsSpent: number
  remainingPoints: number
  defenseRating: number
  attackBonus: number
  maxHp: number | null
  overrideTotals: {
    attackRating: number
    defenseRating: number
    maxHp: number
  }
  attackRollFormula: string
  defenseFormula: string
  hpFormula: string
  pendingItems: string[]
  availableSpells: Spell[]
}

export const deriveCharacter = (
  character: CharacterRecord,
  catalog: Catalog,
): DerivedCharacter => {
  const classEntry = getClassById(catalog, character.classId)
  const raceEntry = getRaceById(catalog, character.raceId)
  const weapon = getEquipmentById(catalog, character.equippedWeaponId)
  const armor = getEquipmentById(catalog, character.equippedArmorId)

  const abilityScores = Object.fromEntries(
    abilityOrder.map((abilityId) => [abilityId, getAbilityScore(character, abilityId, classEntry)]),
  ) as Record<AbilityId, number>

  const abilityModifiers = Object.fromEntries(
    abilityOrder.map((abilityId) => [abilityId, getAbilityModifier(abilityScores[abilityId])]),
  ) as Record<AbilityId, number>

  const pointsSpent = abilityOrder.reduce(
    (total, abilityId) => total + (character.baseAbilityScores[abilityId] - 5),
    0,
  )

  const attackAbility = weapon?.weaponAbility ?? classEntry?.attackAbility ?? 'strength'
  const attackBonus =
    abilityModifiers[attackAbility] + (weapon?.attackBonus ?? 0) + totalOverrides(character.overrides.attackRating)
  const defenseRating =
    abilityScores.agility + (armor?.armor ?? 0) + totalOverrides(character.overrides.defenseRating)
  const baseHp = classEntry?.startingHp ?? null
  const hpFromResilience = classEntry ? abilityModifiers.resilience * Math.max(character.level - 1, 0) : 0
  const maxHp =
    baseHp === null ? null : baseHp + hpFromResilience + totalOverrides(character.overrides.maxHp)

  const pendingItems: string[] = []

  if (!character.name.trim()) {
    pendingItems.push('Add a character name.')
  }

  if (!character.raceId) {
    pendingItems.push('Choose a race.')
  }

  if (!character.classId) {
    pendingItems.push('Choose a class.')
  }

  if (pointsSpent < 3) {
    pendingItems.push(`Spend ${3 - pointsSpent} remaining creation point${pointsSpent === 2 ? '' : 's'}.`)
  }

  if (pointsSpent > 3) {
    pendingItems.push('Reduce base ability scores to stay within the +3 creation budget.')
  }

  if (character.selectedSkillIds.length < 6) {
    pendingItems.push(`Select ${6 - character.selectedSkillIds.length} more common skill${character.selectedSkillIds.length === 5 ? '' : 's'}.`)
  }

  if (character.selectedTalentIds.length + character.customTalents.length < 3) {
    pendingItems.push('Record at least three starting talents.')
  }

  if (!character.equippedWeaponId) {
    pendingItems.push('Equip a weapon.')
  }

  if (!character.equippedArmorId) {
    pendingItems.push('Equip armour or add a note if the class remains unarmoured.')
  }

  if (isCasterClass(classEntry) && character.selectedSpellIds.length + character.customSpells.length < 1) {
    pendingItems.push('Choose at least one spell or record it manually.')
  }

  if (!classEntry?.startingHp) {
    pendingItems.push('This class still needs manual HP review from the handbook reference.')
  }

  return {
    classEntry,
    raceEntry,
    weapon,
    armor,
    abilityScores,
    abilityModifiers,
    pointsSpent,
    remainingPoints: 3 - pointsSpent,
    defenseRating,
    attackBonus,
    maxHp,
    overrideTotals: {
      attackRating: totalOverrides(character.overrides.attackRating),
      defenseRating: totalOverrides(character.overrides.defenseRating),
      maxHp: totalOverrides(character.overrides.maxHp),
    },
    attackRollFormula: `d12 + ${abilityLabels[attackAbility]} modifier${weapon?.attackBonus ? ` + ${weapon.attackBonus} weapon bonus` : ''}${character.overrides.attackRating.length > 0 ? ` + ${totalOverrides(character.overrides.attackRating)} overrides` : ''}`,
    defenseFormula: `Agility score (${abilityScores.agility}) + armour (${armor?.armor ?? 0})${character.overrides.defenseRating.length > 0 ? ` + overrides (${totalOverrides(character.overrides.defenseRating)})` : ''}`,
    hpFormula:
      maxHp === null
        ? 'Class HP is not fully extracted yet; use notes and overrides while checking the handbook.'
        : `${classEntry?.startingHp} base HP + ${Math.max(character.level - 1, 0)} level-ups × Resilience modifier (${abilityModifiers.resilience})${character.overrides.maxHp.length > 0 ? ` + overrides (${totalOverrides(character.overrides.maxHp)})` : ''}`,
    pendingItems,
    availableSpells: catalog.spells.filter((spell) => spell.classIds.includes(character.classId ?? '')),
  }
}
