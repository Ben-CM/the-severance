export type AbilityId =
  | 'strength'
  | 'agility'
  | 'resilience'
  | 'intellect'
  | 'personality'
  | 'arcana'

export type ContentStatus = 'playable' | 'preview'

export interface Sourcebook {
  id: string
  name: string
  shortName: string
  type: string
  notes: string
}

export interface SourceInfo {
  sourceId: string
  sourceLabel: string
  pages: string
}

export interface RuleReference {
  title: string
  text: string
}

export interface Race extends SourceInfo {
  id: string
  name: string
  status: ContentStatus
  summary: string
  rulesText: string
  classIds: string[]
}

export interface CharacterClass extends SourceInfo {
  id: string
  name: string
  raceId: string
  status: ContentStatus
  summary: string
  roleTags: string[]
  rulesText: string
  startingHp?: number
  hitDieLabel?: string
  classAbilityBonus?: AbilityId
  attackAbility?: AbilityId
  armorTraining?: string[]
  heritageName?: string
  heritageTraits?: RuleReference[]
}

export interface Skill extends SourceInfo {
  id: string
  name: string
  kind: 'standard' | 'specialist' | 'combat'
  summary: string
  defaultAbility?: AbilityId
}

export interface Spell extends SourceInfo {
  id: string
  name: string
  status: ContentStatus
  classIds: string[]
  level: number
  kind: 'simple' | 'complex'
  apCost: number
  summary: string
  rulesText: string
  resistance?: string
  success?: string
  resisted?: string
}

export interface EquipmentItem extends SourceInfo {
  id: string
  name: string
  kind: 'weapon' | 'armor' | 'gear'
  status: ContentStatus
  summary: string
  damage?: string
  armor?: number
  weaponAbility?: AbilityId
  attackBonus?: number
  notes?: string
}

export interface OverrideEntry {
  id: string
  label: string
  value: number
}

export interface CustomEntry {
  id: string
  name: string
  details: string
}

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  notes: string
  source: 'official' | 'custom'
  referenceId?: string
}

export interface CharacterRecord {
  id: string
  name: string
  concept: string
  raceId: string | null
  classId: string | null
  level: number
  baseAbilityScores: Record<AbilityId, number>
  selectedSkillIds: string[]
  selectedTalentIds: string[]
  customTalents: CustomEntry[]
  selectedSpellIds: string[]
  customSpells: CustomEntry[]
  equippedWeaponId: string | null
  equippedArmorId: string | null
  inventory: InventoryItem[]
  overrides: {
    attackRating: OverrideEntry[]
    defenseRating: OverrideEntry[]
    maxHp: OverrideEntry[]
  }
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Catalog {
  sourcebooks: Sourcebook[]
  races: Race[]
  classes: CharacterClass[]
  skills: Skill[]
  spells: Spell[]
  equipment: EquipmentItem[]
}
