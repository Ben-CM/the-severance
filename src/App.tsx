import { useEffect, useMemo, useRef, useState } from 'react'
import { catalog } from './content'
import {
  abilityLabels,
  abilityOrder,
  deriveCharacter,
  getClassById,
  getRaceById,
} from './lib/calculations'
import { createCharacter, loadCharacters, saveCharacters, touchCharacter } from './lib/storage'
import type {
  AbilityId,
  CharacterClass,
  CharacterRecord,
  CustomEntry,
  EquipmentItem,
  InventoryItem,
  Race,
  Skill,
  OverrideEntry,
  Spell,
} from './types'

const handbookPdfUrl = new URL('../Sourcebooks/The Severance PHB.pdf', import.meta.url).href

type TabId = 'overview' | 'builder' | 'library' | 'handbook' | 'print'
type LibrarySection = 'classes' | 'races' | 'skills' | 'spells' | 'equipment'
type OverrideBucket = keyof CharacterRecord['overrides']
type AddableList = 'customTalents' | 'customSpells'

type LibraryEntry = CharacterClass | Race | Skill | Spell | EquipmentItem

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'builder', label: 'Builder' },
  { id: 'library', label: 'Library' },
  { id: 'handbook', label: 'Handbook' },
  { id: 'print', label: 'Print / PDF' },
]

const librarySections: Array<{ id: LibrarySection; label: string }> = [
  { id: 'classes', label: 'Classes' },
  { id: 'races', label: 'Races' },
  { id: 'skills', label: 'Skills' },
  { id: 'spells', label: 'Spells' },
  { id: 'equipment', label: 'Equipment' },
]

const classSupportsSpells = (classEntry: CharacterClass | null) =>
  ['order-of-the-aether', 'null-adept', 'sacrist-knight'].includes(classEntry?.id ?? '')

const formatModifier = (value: number) => (value >= 0 ? `+${value}` : `${value}`)

const compareByName = <T extends { name: string }>(left: T, right: T) =>
  left.name.localeCompare(right.name)

function App() {
  const [characters, setCharacters] = useState<CharacterRecord[]>(() => loadCharacters())
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    () => loadCharacters()[0]?.id ?? null,
  )
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [librarySection, setLibrarySection] = useState<LibrarySection>('classes')
  const [librarySelectionId, setLibrarySelectionId] = useState<string | null>(null)
  const [librarySearch, setLibrarySearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    saveCharacters(characters)
  }, [characters])

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedCharacterId) ?? characters[0] ?? null,
    [characters, selectedCharacterId],
  )

  const derived = useMemo(
    () => (selectedCharacter ? deriveCharacter(selectedCharacter, catalog) : null),
    [selectedCharacter],
  )

  const playableClasses = useMemo(
    () => catalog.classes.filter((entry) => entry.status === 'playable').sort(compareByName),
    [],
  )

  const previewClasses = useMemo(
    () => catalog.classes.filter((entry) => entry.status === 'preview').sort(compareByName),
    [],
  )

  const filteredLibraryItems = useMemo(() => {
    const lowered = librarySearch.trim().toLowerCase()
    const items = catalog[librarySection] as LibraryEntry[]

    return items
      .filter((item) => {
        if (!lowered) {
          return true
        }

        const searchable = [item.name, 'summary' in item ? item.summary : '', item.sourceLabel].join(' ')
        return searchable.toLowerCase().includes(lowered)
      })
      .sort(compareByName)
  }, [librarySearch, librarySection])

  const selectedLibraryItem = useMemo(() => {
    const items = catalog[librarySection] as LibraryEntry[]
    return items.find((item) => item.id === librarySelectionId) ?? filteredLibraryItems[0] ?? null
  }, [filteredLibraryItems, librarySection, librarySelectionId])

  const updateCharacter = (updater: (character: CharacterRecord) => CharacterRecord) => {
    if (!selectedCharacter) {
      return
    }

    setCharacters((current) =>
      current.map((character) =>
        character.id === selectedCharacter.id ? touchCharacter(updater(character)) : character,
      ),
    )
  }

  const setAbility = (abilityId: AbilityId, nextValue: number) => {
    updateCharacter((character) => ({
      ...character,
      baseAbilityScores: {
        ...character.baseAbilityScores,
        [abilityId]: Math.min(7, Math.max(5, nextValue)),
      },
    }))
  }

  const toggleSelection = (key: 'selectedSkillIds' | 'selectedTalentIds' | 'selectedSpellIds', value: string) => {
    updateCharacter((character) => {
      const existing = character[key]
      const next = existing.includes(value)
        ? existing.filter((entry) => entry !== value)
        : [...existing, value]

      return {
        ...character,
        [key]: next,
      }
    })
  }

  const addCustomEntry = (listKey: AddableList, name: string, details: string) => {
    if (!name.trim()) {
      return
    }

    updateCharacter((character) => ({
      ...character,
      [listKey]: [
        ...character[listKey],
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          details: details.trim(),
        },
      ],
    }))
  }

  const removeCustomEntry = (listKey: AddableList, entryId: string) => {
    updateCharacter((character) => ({
      ...character,
      [listKey]: character[listKey].filter((entry) => entry.id !== entryId),
    }))
  }

  const addOverride = (bucket: OverrideBucket, label: string, value: number) => {
    if (!label.trim()) {
      return
    }

    updateCharacter((character) => ({
      ...character,
      overrides: {
        ...character.overrides,
        [bucket]: [
          ...character.overrides[bucket],
          {
            id: crypto.randomUUID(),
            label: label.trim(),
            value,
          },
        ],
      },
    }))
  }

  const removeOverride = (bucket: OverrideBucket, entryId: string) => {
    updateCharacter((character) => ({
      ...character,
      overrides: {
        ...character.overrides,
        [bucket]: character.overrides[bucket].filter((entry) => entry.id !== entryId),
      },
    }))
  }

  const addInventoryItem = (item: Partial<InventoryItem> & Pick<InventoryItem, 'name'>) => {
    const name = item.name.trim()
    if (!name) {
      return
    }

    updateCharacter((character) => ({
      ...character,
      inventory: [
        ...character.inventory,
        {
          id: crypto.randomUUID(),
          name,
          quantity: item.quantity ?? 1,
          notes: item.notes ?? '',
          source: item.source ?? 'custom',
          referenceId: item.referenceId,
        },
      ],
    }))
  }

  const removeInventoryItem = (itemId: string) => {
    updateCharacter((character) => ({
      ...character,
      inventory: character.inventory.filter((entry) => entry.id !== itemId),
    }))
  }

  const createNewCharacter = () => {
    const nextCharacter = createCharacter(`Expedition Sheet ${characters.length + 1}`)
    setCharacters((current) => [nextCharacter, ...current])
    setSelectedCharacterId(nextCharacter.id)
    setActiveTab('builder')
  }

  const cloneCharacter = () => {
    if (!selectedCharacter) {
      return
    }

    const clone: CharacterRecord = touchCharacter({
      ...selectedCharacter,
      id: crypto.randomUUID(),
      name: `${selectedCharacter.name || 'Unnamed'} Copy`,
      createdAt: new Date().toISOString(),
    })

    setCharacters((current) => [clone, ...current])
    setSelectedCharacterId(clone.id)
  }

  const deleteCharacter = () => {
    if (!selectedCharacter || characters.length === 1) {
      return
    }

    const remaining = characters.filter((character) => character.id !== selectedCharacter.id)
    setCharacters(remaining)
    setSelectedCharacterId(remaining[0]?.id ?? null)
  }

  const exportCharacters = () => {
    const file = new Blob([JSON.stringify(characters, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'the-severance-characters.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importCharacters = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()

    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        throw new Error('Imported file is not a character array.')
      }

      const imported = parsed.filter((entry): entry is CharacterRecord => Boolean(entry?.id && entry?.name))
      if (imported.length === 0) {
        throw new Error('No valid characters found in import.')
      }

      setCharacters(imported)
      setSelectedCharacterId(imported[0].id)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to import characters.')
    } finally {
      event.target.value = ''
    }
  }

  const addOfficialInventoryItem = (item: EquipmentItem) => {
    addInventoryItem({
      name: item.name,
      quantity: 1,
      notes: item.summary,
      source: 'official',
      referenceId: item.id,
    })
  }

  if (!selectedCharacter || !derived) {
    return null
  }

  const selectedClass = derived.classEntry
  const selectedRace = derived.raceEntry
  const availableClassesForRace = selectedCharacter.raceId
    ? playableClasses.filter((entry) => entry.raceId === selectedCharacter.raceId)
    : playableClasses
  const availableSpells = catalog.spells.filter((spell) => spell.classIds.includes(selectedCharacter.classId ?? ''))

  return (
    <div className="app-shell">
      <aside className="sidebar hide-on-print">
        <div className="brand">
          <span className="kicker">The Severance</span>
          <h1>Character Keeper</h1>
          <p>
            A lightweight, data-driven character sheet manager using official PHB content,
            local saves, manual overrides and future-ready JSON content packs.
          </p>
        </div>

        <div className="sidebar-actions">
          <button className="primary-button" type="button" onClick={createNewCharacter}>
            New character
          </button>
          <button className="secondary-button" type="button" onClick={cloneCharacter}>
            Clone
          </button>
        </div>

        <div className="characters">
          {characters.map((character) => {
            const classEntry = getClassById(catalog, character.classId)
            const raceEntry = getRaceById(catalog, character.raceId)
            const incompleteCount = deriveCharacter(character, catalog).pendingItems.length

            return (
              <button
                key={character.id}
                className={`character-card ${character.id === selectedCharacter.id ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedCharacterId(character.id)}
              >
                <div className="card-top">
                  <strong>{character.name || 'Unnamed character'}</strong>
                  {incompleteCount > 0 ? (
                    <span className="pending-pill">{incompleteCount} pending</span>
                  ) : (
                    <span className="status-pill playable">Ready</span>
                  )}
                </div>
                <div className="card-meta muted">
                  <span>{classEntry?.name ?? 'No class selected'}</span>
                  <span>{raceEntry?.name ?? 'No race selected'}</span>
                </div>
                <span className="caption">Level {character.level}</span>
              </button>
            )
          })}
        </div>

        <div className="sidebar-actions">
          <button className="secondary-button" type="button" onClick={exportCharacters}>
            Export JSON
          </button>
          <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <button className="ghost-button" type="button" onClick={deleteCharacter} disabled={characters.length === 1}>
            Delete
          </button>
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json"
            onChange={importCharacters}
          />
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Sourcebooks</h3>
          </div>
          {catalog.sourcebooks.map((sourcebook) => (
            <div key={sourcebook.id} className="stack">
              <strong>{sourcebook.shortName}</strong>
              <span className="caption">{sourcebook.type}</span>
              <span>{sourcebook.notes}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="main-content">
        <header className="content-header">
          <div className="section-heading">
            <div className="stack">
              <span className="kicker">Current sheet</span>
              <h2>{selectedCharacter.name || 'Unnamed character'}</h2>
              <p>
                {selectedRace?.name ?? 'Choose a race'} · {selectedClass?.name ?? 'Choose a class'} · Level{' '}
                {selectedCharacter.level}
              </p>
            </div>
            <div className="tag-list">
              {selectedClass?.roleTags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="nav-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {activeTab === 'overview' ? (
          <OverviewTab character={selectedCharacter} derived={derived} />
        ) : null}

        {activeTab === 'builder' ? (
          <BuilderTab
            character={selectedCharacter}
            derived={derived}
            availableClassesForRace={availableClassesForRace}
            availableSpells={availableSpells}
            previewClasses={previewClasses}
            onCharacterChange={updateCharacter}
            onSetAbility={setAbility}
            onToggleSelection={toggleSelection}
            onAddCustomEntry={addCustomEntry}
            onRemoveCustomEntry={removeCustomEntry}
            onAddOverride={addOverride}
            onRemoveOverride={removeOverride}
            onAddInventoryItem={addInventoryItem}
            onRemoveInventoryItem={removeInventoryItem}
            onAddOfficialInventoryItem={addOfficialInventoryItem}
          />
        ) : null}

        {activeTab === 'library' ? (
          <LibraryTab
            search={librarySearch}
            onSearchChange={setLibrarySearch}
            section={librarySection}
            onSectionChange={setLibrarySection}
            items={filteredLibraryItems}
            selectedId={selectedLibraryItem?.id ?? null}
            onSelect={setLibrarySelectionId}
            selectedItem={selectedLibraryItem}
          />
        ) : null}

        {activeTab === 'handbook' ? <HandbookTab /> : null}

        {activeTab === 'print' ? (
          <PrintTab character={selectedCharacter} derived={derived} onPrint={() => window.print()} />
        ) : null}
      </main>
    </div>
  )
}

function OverviewTab({
  character,
  derived,
}: {
  character: CharacterRecord
  derived: ReturnType<typeof deriveCharacter>
}) {
  return (
    <section className="overview-grid">
      <article className="panel span-8">
        <div className="panel-header">
          <h3>Ability scores</h3>
          <span className="source-pill">Creation points: {derived.pointsSpent} / 3</span>
        </div>
        <div className="ability-grid">
          {abilityOrder.map((abilityId) => (
            <div key={abilityId} className="ability-card">
              <div className="score-row">
                <span>{abilityLabels[abilityId]}</span>
                <strong>{derived.abilityScores[abilityId]}</strong>
              </div>
              <span>Modifier {formatModifier(derived.abilityModifiers[abilityId])}</span>
              <span className="caption">Base {character.baseAbilityScores[abilityId]}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel span-4">
        <div className="panel-header">
          <h3>Completion state</h3>
          <span className="status-pill playable">Resumable</span>
        </div>
        {derived.pendingItems.length > 0 ? (
          <ul className="pending-list">
            {derived.pendingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <div className="alert neutral">This sheet currently has no flagged missing choices.</div>
        )}
      </article>

      <article className="panel span-12">
        <div className="panel-header">
          <h3>Derived values</h3>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <span>Attack bonus</span>
            <strong>{formatModifier(derived.attackBonus)}</strong>
            <span>{derived.attackRollFormula}</span>
          </div>
          <div className="stat-card">
            <span>Defense rating</span>
            <strong>{derived.defenseRating}</strong>
            <span>{derived.defenseFormula}</span>
          </div>
          <div className="stat-card">
            <span>Max HP</span>
            <strong>{derived.maxHp ?? 'Review'}</strong>
            <span>{derived.hpFormula}</span>
          </div>
          <div className="stat-card">
            <span>Action points</span>
            <strong>5</strong>
            <span>Per combat round</span>
          </div>
          <div className="stat-card">
            <span>Weapon</span>
            <strong>{derived.weapon?.name ?? 'None'}</strong>
            <span>{derived.weapon?.damage ?? 'Select or add a weapon'}</span>
          </div>
          <div className="stat-card">
            <span>Armour</span>
            <strong>{derived.armor?.name ?? 'None'}</strong>
            <span>{derived.armor?.armor ? `Protection ${derived.armor.armor}` : 'Unarmoured or not recorded'}</span>
          </div>
        </div>
      </article>

      <article className="panel span-6">
        <div className="panel-header">
          <h3>Official selections</h3>
        </div>
        <div className="stack">
          <strong>Common skills</strong>
          <span>{character.selectedSkillIds.length > 0 ? character.selectedSkillIds.join(', ') : 'None selected yet.'}</span>
        </div>
        <div className="stack">
          <strong>Talents</strong>
          <span>
            {character.selectedTalentIds.length + character.customTalents.length > 0
              ? `${character.selectedTalentIds.length} official, ${character.customTalents.length} custom/manual`
              : 'No talents recorded yet.'}
          </span>
        </div>
        <div className="stack">
          <strong>Spells</strong>
          <span>
            {character.selectedSpellIds.length + character.customSpells.length > 0
              ? `${character.selectedSpellIds.length} official, ${character.customSpells.length} custom/manual`
              : 'No spells recorded yet.'}
          </span>
        </div>
      </article>

      <article className="panel span-6">
        <div className="panel-header">
          <h3>Manual notes</h3>
        </div>
        <p>{character.notes.trim() || 'No notes yet.'}</p>
      </article>
    </section>
  )
}

function BuilderTab({
  character,
  derived,
  availableClassesForRace,
  availableSpells,
  previewClasses,
  onCharacterChange,
  onSetAbility,
  onToggleSelection,
  onAddCustomEntry,
  onRemoveCustomEntry,
  onAddOverride,
  onRemoveOverride,
  onAddInventoryItem,
  onRemoveInventoryItem,
  onAddOfficialInventoryItem,
}: {
  character: CharacterRecord
  derived: ReturnType<typeof deriveCharacter>
  availableClassesForRace: CharacterClass[]
  availableSpells: Spell[]
  previewClasses: CharacterClass[]
  onCharacterChange: (updater: (character: CharacterRecord) => CharacterRecord) => void
  onSetAbility: (abilityId: AbilityId, nextValue: number) => void
  onToggleSelection: (
    key: 'selectedSkillIds' | 'selectedTalentIds' | 'selectedSpellIds',
    value: string,
  ) => void
  onAddCustomEntry: (listKey: AddableList, name: string, details: string) => void
  onRemoveCustomEntry: (listKey: AddableList, entryId: string) => void
  onAddOverride: (bucket: OverrideBucket, label: string, value: number) => void
  onRemoveOverride: (bucket: OverrideBucket, entryId: string) => void
  onAddInventoryItem: (item: Partial<InventoryItem> & Pick<InventoryItem, 'name'>) => void
  onRemoveInventoryItem: (itemId: string) => void
  onAddOfficialInventoryItem: (item: EquipmentItem) => void
}) {
  const [customTalentName, setCustomTalentName] = useState('')
  const [customTalentDetails, setCustomTalentDetails] = useState('')
  const [customSpellName, setCustomSpellName] = useState('')
  const [customSpellDetails, setCustomSpellDetails] = useState('')
  const [customItemName, setCustomItemName] = useState('')
  const [customItemQuantity, setCustomItemQuantity] = useState(1)
  const [customItemNotes, setCustomItemNotes] = useState('')
  const [overrideForms, setOverrideForms] = useState<Record<OverrideBucket, { label: string; value: number }>>({
    attackRating: { label: '', value: 0 },
    defenseRating: { label: '', value: 0 },
    maxHp: { label: '', value: 0 },
  })

  const raceClasses = catalog.classes
    .filter((entry) => entry.raceId === character.raceId)
    .sort(compareByName)

  const armorOptions = catalog.equipment.filter((item) => item.kind === 'armor').sort(compareByName)
  const weaponOptions = catalog.equipment.filter((item) => item.kind === 'weapon').sort(compareByName)
  const gearOptions = catalog.equipment.filter((item) => item.kind === 'gear').sort(compareByName)

  const handleInput = <K extends keyof CharacterRecord>(key: K, value: CharacterRecord[K]) => {
    onCharacterChange((current) => ({
      ...current,
      [key]: value,
      ...(key === 'raceId'
        ? {
            classId:
              current.classId &&
              catalog.classes.some(
                (entry) => entry.id === current.classId && entry.raceId === value,
              )
                ? current.classId
                : null,
          }
        : {}),
    }))
  }

  return (
    <section className="builder-grid">
      <article className="panel span-5">
        <div className="panel-header">
          <h3>Identity & core choices</h3>
          <span className="source-pill">Level {character.level}</span>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Character name</label>
            <input
              id="name"
              value={character.name}
              onChange={(event) => handleInput('name', event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="level">Level</label>
            <input
              id="level"
              type="number"
              min={1}
              max={12}
              value={character.level}
              onChange={(event) => handleInput('level', Number(event.target.value) || 1)}
            />
          </div>
          <div className="field">
            <label htmlFor="race">Race</label>
            <select
              id="race"
              value={character.raceId ?? ''}
              onChange={(event) => handleInput('raceId', event.target.value || null)}
            >
              <option value="">Choose a race</option>
              {catalog.races.sort(compareByName).map((race) => (
                <option key={race.id} value={race.id}>
                  {race.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="class">Class</label>
            <select
              id="class"
              value={character.classId ?? ''}
              onChange={(event) => handleInput('classId', event.target.value || null)}
            >
              <option value="">Choose a class</option>
              {availableClassesForRace.sort(compareByName).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            {character.raceId && raceClasses.some((entry) => entry.status === 'preview') ? (
              <span className="field-hint">
                Preview-only class concepts for this race: {raceClasses.filter((entry) => entry.status === 'preview').map((entry) => entry.name).join(', ')}.
              </span>
            ) : null}
          </div>
          <div className="field span-2">
            <label htmlFor="concept">Concept / notes</label>
            <textarea
              id="concept"
              value={character.concept}
              onChange={(event) => handleInput('concept', event.target.value)}
            />
          </div>
        </div>
        {previewClasses.length > 0 ? (
          <div className="alert neutral">
            The current PHB explicitly notes that only seven classes are fully available. Preview classes
            remain in the library for future official or homebrew JSON expansions.
          </div>
        ) : null}
      </article>

      <article className="panel span-7">
        <div className="panel-header">
          <h3>Ability scores</h3>
          <span className="source-pill">Remaining: {derived.remainingPoints}</span>
        </div>
        <div className="points-banner">
          Start every ability at 5. Spend exactly +3 points total, with no base score above 7. Known class
          bonuses are applied automatically on top.
        </div>
        <div className="ability-grid">
          {abilityOrder.map((abilityId) => (
            <div key={abilityId} className="ability-card">
              <div className="score-row">
                <span>{abilityLabels[abilityId]}</span>
                <strong>{derived.abilityScores[abilityId]}</strong>
              </div>
              <span>
                Base {character.baseAbilityScores[abilityId]} {selectedClassBonusText(derived.classEntry, abilityId)}
              </span>
              <div className="inline-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onSetAbility(abilityId, character.baseAbilityScores[abilityId] - 1)}
                >
                  −
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onSetAbility(abilityId, character.baseAbilityScores[abilityId] + 1)}
                >
                  +
                </button>
              </div>
              <span>Modifier {formatModifier(derived.abilityModifiers[abilityId])}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel span-6">
        <div className="panel-header">
          <h3>Common skills</h3>
          <span className="source-pill">{character.selectedSkillIds.length} / 6 chosen</span>
        </div>
        <div className="checkbox-list">
          {catalog.skills.sort(compareByName).map((skill) => (
            <label key={skill.id}>
              <input
                type="checkbox"
                checked={character.selectedSkillIds.includes(skill.id)}
                onChange={() => onToggleSelection('selectedSkillIds', skill.id)}
              />
              <span>
                <strong>{skill.name}</strong>
                <br />
                {skill.summary}
                <br />
                <span className="caption">
                  {skill.kind} · {skill.defaultAbility ? abilityLabels[skill.defaultAbility] : 'Situational'}
                </span>
              </span>
            </label>
          ))}
        </div>
      </article>

      <article className="panel span-6">
        <div className="panel-header">
          <h3>Talents & manual additions</h3>
          <span className="source-pill">Leave unfinished if needed</span>
        </div>
        <div className="alert neutral">
          The handbook notes that several talent lists are truncated. Official talents can be added as JSON later;
          use manual entries now when the PHB reference has the exact wording you need.
        </div>
        <div className="stack">
          <strong className="subsection-title">Official toggles</strong>
          <div className="checkbox-list">
            <label>
              <input
                type="checkbox"
                checked={character.selectedTalentIds.includes('beatdown')}
                onChange={() => onToggleSelection('selectedTalentIds', 'beatdown')}
              />
              <span>
                <strong>Beatdown (example official talent)</strong>
                <br />
                Referenced in the handbook as a Street Fighter talent prerequisite for Pneumatic Knuckles.
              </span>
            </label>
          </div>
        </div>
        <CustomEntryForm
          title="Add manual talent"
          name={customTalentName}
          details={customTalentDetails}
          onNameChange={setCustomTalentName}
          onDetailsChange={setCustomTalentDetails}
          onAdd={() => {
            onAddCustomEntry('customTalents', customTalentName, customTalentDetails)
            setCustomTalentName('')
            setCustomTalentDetails('')
          }}
        />
        <CustomEntryList entries={character.customTalents} onRemove={(entryId) => onRemoveCustomEntry('customTalents', entryId)} />
      </article>

      <article className="panel span-6">
        <div className="panel-header">
          <h3>Spells</h3>
          <span className="source-pill">{classSupportsSpells(derived.classEntry) ? 'Caster support' : 'Optional'}</span>
        </div>
        {classSupportsSpells(derived.classEntry) ? (
          <>
            {availableSpells.length > 0 ? (
              <div className="checkbox-list">
                {availableSpells.map((spell) => (
                  <label key={spell.id}>
                    <input
                      type="checkbox"
                      checked={character.selectedSpellIds.includes(spell.id)}
                      onChange={() => onToggleSelection('selectedSpellIds', spell.id)}
                    />
                    <span>
                      <strong>{spell.name}</strong>
                      <br />
                      {spell.summary}
                      <br />
                      <span className="caption">
                        Level {spell.level} · {spell.kind} · {spell.apCost} AP
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No structured official spell entries loaded yet for this class. Use manual spell entries while the
                PHB spell list is still being encoded into JSON.
              </div>
            )}
          </>
        ) : (
          <div className="alert neutral">This class currently has no spell list attached in the loaded JSON content.</div>
        )}
        <CustomEntryForm
          title="Add manual spell"
          name={customSpellName}
          details={customSpellDetails}
          onNameChange={setCustomSpellName}
          onDetailsChange={setCustomSpellDetails}
          onAdd={() => {
            onAddCustomEntry('customSpells', customSpellName, customSpellDetails)
            setCustomSpellName('')
            setCustomSpellDetails('')
          }}
        />
        <CustomEntryList entries={character.customSpells} onRemove={(entryId) => onRemoveCustomEntry('customSpells', entryId)} />
      </article>

      <article className="panel span-6">
        <div className="panel-header">
          <h3>Equipment</h3>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="weapon">Weapon</label>
            <select
              id="weapon"
              value={character.equippedWeaponId ?? ''}
              onChange={(event) => onCharacterChange((current) => ({ ...current, equippedWeaponId: event.target.value || null }))}
            >
              <option value="">Choose a weapon</option>
              {weaponOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="field-hint">{derived.weapon?.damage ?? 'No weapon equipped.'}</span>
          </div>
          <div className="field">
            <label htmlFor="armor">Armour</label>
            <select
              id="armor"
              value={character.equippedArmorId ?? ''}
              onChange={(event) => onCharacterChange((current) => ({ ...current, equippedArmorId: event.target.value || null }))}
            >
              <option value="">Choose armour</option>
              {armorOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="field-hint">
              {derived.armor?.armor ? `Protection +${derived.armor.armor}` : 'No armour equipped.'}
            </span>
          </div>
        </div>
        {derived.classEntry?.armorTraining ? (
          <div className="alert neutral">
            Official training: {derived.classEntry.armorTraining.join(', ')}.
          </div>
        ) : null}
        <div className="stack">
          <strong className="subsection-title">Quick add official gear</strong>
          <div className="selection-grid">
            {gearOptions.map((item) => (
              <button key={item.id} className="secondary-button" type="button" onClick={() => onAddOfficialInventoryItem(item)}>
                Add {item.name}
              </button>
            ))}
          </div>
        </div>
      </article>

      <article className="panel span-6">
        <div className="panel-header">
          <h3>Inventory</h3>
          <span className="source-pill">Custom items supported</span>
        </div>
        <div className="inventory-list">
          {character.inventory.length > 0 ? (
            character.inventory.map((item) => (
              <div key={item.id} className="inventory-item">
                <div className="stack">
                  <strong>
                    {item.name} ×{item.quantity}
                  </strong>
                  <span>{item.notes || 'No notes'}</span>
                  <span className="caption">{item.source}</span>
                </div>
                <button className="icon-button" type="button" onClick={() => onRemoveInventoryItem(item.id)}>
                  ×
                </button>
              </div>
            ))
          ) : (
            <div className="empty-state">No inventory items recorded yet.</div>
          )}
        </div>
        <div className="add-row">
          <input
            placeholder="Custom item name"
            value={customItemName}
            onChange={(event) => setCustomItemName(event.target.value)}
          />
          <input
            type="number"
            min={1}
            value={customItemQuantity}
            onChange={(event) => setCustomItemQuantity(Number(event.target.value) || 1)}
          />
          <textarea
            placeholder="Details or rules text"
            value={customItemNotes}
            onChange={(event) => setCustomItemNotes(event.target.value)}
          />
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              onAddInventoryItem({
                name: customItemName,
                quantity: customItemQuantity,
                notes: customItemNotes,
                source: 'custom',
              })
              setCustomItemName('')
              setCustomItemQuantity(1)
              setCustomItemNotes('')
            }}
          >
            Add custom item
          </button>
        </div>
      </article>

      <article className="panel span-12">
        <div className="panel-header">
          <h3>Manual overrides</h3>
          <span className="source-pill">e.g. +1: Temporary boost</span>
        </div>
        <div className="selection-grid">
          <OverrideEditor
            title="Attack rating adjustments"
            bucket="attackRating"
            entries={character.overrides.attackRating}
            form={overrideForms.attackRating}
            onFormChange={(next) =>
              setOverrideForms((current) => ({ ...current, attackRating: { ...current.attackRating, ...next } }))
            }
            onAdd={onAddOverride}
            onRemove={onRemoveOverride}
          />
          <OverrideEditor
            title="Defense rating adjustments"
            bucket="defenseRating"
            entries={character.overrides.defenseRating}
            form={overrideForms.defenseRating}
            onFormChange={(next) =>
              setOverrideForms((current) => ({ ...current, defenseRating: { ...current.defenseRating, ...next } }))
            }
            onAdd={onAddOverride}
            onRemove={onRemoveOverride}
          />
          <OverrideEditor
            title="HP adjustments"
            bucket="maxHp"
            entries={character.overrides.maxHp}
            form={overrideForms.maxHp}
            onFormChange={(next) =>
              setOverrideForms((current) => ({ ...current, maxHp: { ...current.maxHp, ...next } }))
            }
            onAdd={onAddOverride}
            onRemove={onRemoveOverride}
          />
        </div>
      </article>

      <article className="panel span-12">
        <div className="panel-header">
          <h3>Notes</h3>
        </div>
        <div className="field">
          <textarea
            value={character.notes}
            onChange={(event) => onCharacterChange((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Campaign notes, unresolved PHB details, class-specific edge cases, source references..."
          />
        </div>
      </article>
    </section>
  )
}

function LibraryTab({
  search,
  onSearchChange,
  section,
  onSectionChange,
  items,
  selectedId,
  onSelect,
  selectedItem,
}: {
  search: string
  onSearchChange: (value: string) => void
  section: LibrarySection
  onSectionChange: (value: LibrarySection) => void
  items: LibraryEntry[]
  selectedId: string | null
  onSelect: (value: string) => void
  selectedItem: LibraryEntry | null
}) {
  return (
    <section className="sheet-grid">
      <article className="panel span-5">
        <div className="panel-header">
          <h3>Content library</h3>
        </div>
        <div className="nav-tabs">
          {librarySections.map((entry) => (
            <button
              key={entry.id}
              className={`tab-button ${section === entry.id ? 'active' : ''}`}
              type="button"
              onClick={() => onSectionChange(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          placeholder="Search current content type"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <div className="library-grid">
          {items.map((item) => (
            <button
              key={item.id}
              className={`library-card ${selectedId === item.id ? 'active' : ''}`}
              type="button"
              onClick={() => onSelect(item.id)}
            >
              <header>
                <strong>{item.name}</strong>
                {'status' in item ? <span className={`status-pill ${item.status}`}>{item.status}</span> : null}
              </header>
              <p>{item.summary}</p>
              <span className="caption">
                {item.sourceLabel} · p. {item.pages}
              </span>
            </button>
          ))}
        </div>
      </article>

      <article className="panel span-7">
        {selectedItem ? (
          <>
            <div className="panel-header">
              <h3>{selectedItem.name}</h3>
              <span className="source-pill">
                {selectedItem.sourceLabel} · p. {selectedItem.pages}
              </span>
            </div>
            {'roleTags' in selectedItem ? (
              <div className="tag-list">
                {selectedItem.roleTags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {'kind' in selectedItem && typeof selectedItem.kind === 'string' ? (
              <div className="alert neutral">Type: {selectedItem.kind}</div>
            ) : null}
            <p>{selectedItem.summary}</p>
            {'rulesText' in selectedItem ? <p>{selectedItem.rulesText}</p> : null}
            {'heritageTraits' in selectedItem && selectedItem.heritageTraits ? (
              <div className="stack">
                <strong>Heritage traits</strong>
                {selectedItem.heritageTraits.map((trait) => (
                  <div key={trait.title} className="reference-card">
                    <header>
                      <strong>{trait.title}</strong>
                    </header>
                    <p>{trait.text}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {'success' in selectedItem && (selectedItem.success || selectedItem.resisted) ? (
              <div className="selection-grid">
                {selectedItem.success ? (
                  <div className="reference-card">
                    <header>
                      <strong>Success</strong>
                    </header>
                    <p>{selectedItem.success}</p>
                  </div>
                ) : null}
                {selectedItem.resisted ? (
                  <div className="reference-card">
                    <header>
                      <strong>Resisted</strong>
                    </header>
                    <p>{selectedItem.resisted}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">No content matched the current filters.</div>
        )}
      </article>
    </section>
  )
}

function HandbookTab() {
  return (
    <section className="sheet-grid">
      <article className="panel span-12">
        <div className="panel-header">
          <h3>In-app handbook reference</h3>
          <span className="source-pill">Standalone rules access</span>
        </div>
        <div className="rule-shortcuts">
          <div className="shortcut-card">
            <header>
              <strong>Core rules</strong>
            </header>
            <p>Basic Rules, combat, conditions, resistance and strain are covered on pages 3-25.</p>
          </div>
          <div className="shortcut-card">
            <header>
              <strong>Common skills</strong>
            </header>
            <p>See pages 27-28 for the extracted common skill list and specialist skills.</p>
          </div>
          <div className="shortcut-card">
            <header>
              <strong>Detailed classes</strong>
            </header>
            <p>Current detailed class chapters begin on pages 30, 35, 40, 46, 50, 56 and 62.</p>
          </div>
          <div className="shortcut-card">
            <header>
              <strong>Spells & gear</strong>
            </header>
            <p>Helfin spells begin on page 66, Null Adept spells on 69, and weapons/armour on 71.</p>
          </div>
        </div>
        <div className="reference-frame">
          <object data={handbookPdfUrl} type="application/pdf" aria-label="The Severance Handbook PDF">
            <iframe src={handbookPdfUrl} title="The Severance Handbook PDF fallback"></iframe>
          </object>
        </div>
      </article>
    </section>
  )
}

function PrintTab({
  character,
  derived,
  onPrint,
}: {
  character: CharacterRecord
  derived: ReturnType<typeof deriveCharacter>
  onPrint: () => void
}) {
  const selectedSkillNames = character.selectedSkillIds
    .map((skillId) => catalog.skills.find((skill) => skill.id === skillId)?.name)
    .filter(Boolean)

  const selectedSpellNames = character.selectedSpellIds
    .map((spellId) => catalog.spells.find((spell) => spell.id === spellId)?.name)
    .filter(Boolean)

  return (
    <section className="sheet-grid">
      <article className="panel span-12 hide-on-print">
        <div className="panel-header">
          <h3>Print preparation</h3>
          <button className="primary-button" type="button" onClick={onPrint}>
            Print / save as PDF
          </button>
        </div>
        <p>
          This view is laid out as a clean multi-page print sheet. Use your browser’s print dialog to save a PDF.
        </p>
      </article>

      <article className="panel span-12 print-sheet">
        <div className="print-grid print-block">
          <div className="stat-card">
            <span>Name</span>
            <strong>{character.name || 'Unnamed character'}</strong>
          </div>
          <div className="stat-card">
            <span>Race</span>
            <strong>{derived.raceEntry?.name ?? 'Unchosen'}</strong>
          </div>
          <div className="stat-card">
            <span>Class</span>
            <strong>{derived.classEntry?.name ?? 'Unchosen'}</strong>
          </div>
          <div className="stat-card">
            <span>Level</span>
            <strong>{character.level}</strong>
          </div>
        </div>

        <div className="print-grid print-block">
          {abilityOrder.map((abilityId) => (
            <div key={abilityId} className="ability-card">
              <span>{abilityLabels[abilityId]}</span>
              <strong>{derived.abilityScores[abilityId]}</strong>
              <span>Mod {formatModifier(derived.abilityModifiers[abilityId])}</span>
            </div>
          ))}
        </div>

        <div className="print-grid print-block">
          <div className="stat-card">
            <span>Attack bonus</span>
            <strong>{formatModifier(derived.attackBonus)}</strong>
            <span>{derived.attackRollFormula}</span>
          </div>
          <div className="stat-card">
            <span>Defense rating</span>
            <strong>{derived.defenseRating}</strong>
            <span>{derived.defenseFormula}</span>
          </div>
          <div className="stat-card">
            <span>Max HP</span>
            <strong>{derived.maxHp ?? 'Review'}</strong>
            <span>{derived.hpFormula}</span>
          </div>
          <div className="stat-card">
            <span>Weapon / armour</span>
            <strong>
              {derived.weapon?.name ?? 'None'} / {derived.armor?.name ?? 'None'}
            </strong>
            <span>
              {derived.weapon?.damage ?? '—'} · {derived.armor?.armor ? `Protection +${derived.armor.armor}` : 'No armour'}
            </span>
          </div>
        </div>

        <div className="print-grid print-block">
          <div className="panel print-block">
            <h3>Skills</h3>
            <ul>
              {selectedSkillNames.length > 0 ? selectedSkillNames.map((skillName) => <li key={skillName}>{skillName}</li>) : <li>None recorded</li>}
            </ul>
          </div>
          <div className="panel print-block">
            <h3>Talents</h3>
            <ul>
              {character.selectedTalentIds.length > 0 ? character.selectedTalentIds.map((talentId) => <li key={talentId}>{talentId}</li>) : null}
              {character.customTalents.map((talent) => (
                <li key={talent.id}>
                  <strong>{talent.name}</strong>: {talent.details}
                </li>
              ))}
              {character.selectedTalentIds.length === 0 && character.customTalents.length === 0 ? <li>None recorded</li> : null}
            </ul>
          </div>
        </div>

        <div className="print-grid print-block">
          <div className="panel print-block">
            <h3>Spells</h3>
            <ul>
              {selectedSpellNames.length > 0 ? selectedSpellNames.map((spellName) => <li key={spellName}>{spellName}</li>) : null}
              {character.customSpells.map((spell) => (
                <li key={spell.id}>
                  <strong>{spell.name}</strong>: {spell.details}
                </li>
              ))}
              {selectedSpellNames.length === 0 && character.customSpells.length === 0 ? <li>None recorded</li> : null}
            </ul>
          </div>
          <div className="panel print-block">
            <h3>Inventory</h3>
            <ul>
              {character.inventory.length > 0 ? (
                character.inventory.map((item) => (
                  <li key={item.id}>
                    <strong>{item.name}</strong> ×{item.quantity}
                    {item.notes ? ` — ${item.notes}` : ''}
                  </li>
                ))
              ) : (
                <li>None recorded</li>
              )}
            </ul>
          </div>
        </div>

        <div className="panel print-block">
          <h3>Notes</h3>
          <p>{character.notes || character.concept || 'No notes recorded.'}</p>
          <p className="footer-note">
            Source references: {derived.raceEntry?.sourceLabel ?? '—'} p. {derived.raceEntry?.pages ?? '—'} ·{' '}
            {derived.classEntry?.sourceLabel ?? '—'} p. {derived.classEntry?.pages ?? '—'}
          </p>
        </div>
      </article>
    </section>
  )
}

function CustomEntryForm({
  title,
  name,
  details,
  onNameChange,
  onDetailsChange,
  onAdd,
}: {
  title: string
  name: string
  details: string
  onNameChange: (value: string) => void
  onDetailsChange: (value: string) => void
  onAdd: () => void
}) {
  return (
    <div className="add-row">
      <strong className="subsection-title">{title}</strong>
      <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Name" />
      <textarea
        value={details}
        onChange={(event) => onDetailsChange(event.target.value)}
        placeholder="Rules text or notes"
      />
      <button className="secondary-button" type="button" onClick={onAdd}>
        Add entry
      </button>
    </div>
  )
}

function CustomEntryList({ entries, onRemove }: { entries: CustomEntry[]; onRemove: (entryId: string) => void }) {
  if (entries.length === 0) {
    return <div className="empty-state">No manual entries added yet.</div>
  }

  return (
    <div className="selection-grid">
      {entries.map((entry) => (
        <div key={entry.id} className="reference-card">
          <header>
            <strong>{entry.name}</strong>
            <button className="icon-button" type="button" onClick={() => onRemove(entry.id)}>
              ×
            </button>
          </header>
          <p>{entry.details || 'No details provided.'}</p>
        </div>
      ))}
    </div>
  )
}

function OverrideEditor({
  title,
  bucket,
  entries,
  form,
  onFormChange,
  onAdd,
  onRemove,
}: {
  title: string
  bucket: OverrideBucket
  entries: OverrideEntry[]
  form: { label: string; value: number }
  onFormChange: (next: Partial<{ label: string; value: number }>) => void
  onAdd: (bucket: OverrideBucket, label: string, value: number) => void
  onRemove: (bucket: OverrideBucket, entryId: string) => void
}) {
  return (
    <div className="reference-card">
      <header>
        <strong>{title}</strong>
      </header>
      <div className="add-row">
        <input
          placeholder="Label"
          value={form.label}
          onChange={(event) => onFormChange({ label: event.target.value })}
        />
        <input
          type="number"
          value={form.value}
          onChange={(event) => onFormChange({ value: Number(event.target.value) || 0 })}
        />
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            onAdd(bucket, form.label, form.value)
            onFormChange({ label: '', value: 0 })
          }}
        >
          Add override
        </button>
      </div>
      <div className="override-list">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div key={entry.id} className="override-item">
              <div className="stack">
                <strong>
                  {formatModifier(entry.value)} · {entry.label}
                </strong>
              </div>
              <button className="icon-button" type="button" onClick={() => onRemove(bucket, entry.id)}>
                ×
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state">No overrides yet.</div>
        )}
      </div>
    </div>
  )
}

function selectedClassBonusText(classEntry: CharacterClass | null, abilityId: AbilityId) {
  return classEntry?.classAbilityBonus === abilityId ? '(+1 class bonus)' : ''
}

export default App
