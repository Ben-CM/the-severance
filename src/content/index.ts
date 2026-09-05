import classesData from './classes/phb.json'
import equipmentData from './equipment/phb.json'
import racesData from './races/phb.json'
import skillsData from './skills/phb.json'
import sourcebooksData from './sourcebooks.json'
import spellsData from './spells/phb.json'
import type { Catalog } from '../types'

export const catalog: Catalog = {
  sourcebooks: sourcebooksData as Catalog['sourcebooks'],
  races: racesData as Catalog['races'],
  classes: classesData as Catalog['classes'],
  skills: skillsData as Catalog['skills'],
  spells: spellsData as Catalog['spells'],
  equipment: equipmentData as Catalog['equipment'],
}
