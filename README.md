# The Severance Character Keeper

A React + TypeScript + LESS character sheet manager for **The Severance**.

## MVP focus

- Local multi-character storage
- Data-driven races, classes, skills, spells and equipment
- Derived combat values like Attack bonus and Defense Rating
- Manual override support with labels such as `+1: Temporary boost`
- In-app PHB access from `Sourcebooks/The Severance PHB.pdf`
- Multi-page print / PDF export via the browser print dialog
- Extensible JSON content packs with source metadata for official and homebrew content

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Content structure

Official starter content lives under `src/content/**` and is split by type:

- `src/content/races/*.json`
- `src/content/classes/*.json`
- `src/content/skills/*.json`
- `src/content/spells/*.json`
- `src/content/equipment/*.json`

Each entry carries source metadata so future hand-authored homebrew or collaboration packs can be added alongside PHB data.
