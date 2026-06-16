# messenger-copy

Unofficial learning workspace that mirrors assets, shaders, and scene structure from [**Messenger**](https://messenger.abeto.co/) by [abeto](https://abeto.co/).

> **Disclaimer:** This is not the real game. It is a local, AI-assisted rebuild for study only. All original art, audio, and design remain the property of their respective owners. See [ATTRIBUTION.md](./ATTRIBUTION.md).

## What this is

- A SvelteKit + Three.js preview with **Intro**, **Gameplay**, and **NPC** scene modes
- Downloaded reference bundles under `reference/messenger.abeto.co/`
- Ported/simplified GLSL materials, Draco loaders, and post-processing experiments

## License

- **Repository code** (`src/`, scripts, config): [MIT](./LICENSE)
- **Reference assets** (`reference/`, `static/messenger`): belong to the original Messenger project — do not redistribute without permission

## Develop

```sh
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

### Reference tooling

```sh
pnpm reference:discover   # find asset URLs from bundles
pnpm reference:download   # fetch missing reference files
pnpm reference:shaders    # extract GLSL from JS bundles
```

## Stack

- SvelteKit 2 / Svelte 5
- Three.js r184
- TypeScript, Tailwind CSS, Vitest
