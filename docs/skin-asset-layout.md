## Skin Asset Layout

This repo currently uses two different skin-asset channels:

1. Runtime CDN assets
2. Server-side tool workspace assets

### Runtime CDN assets

Mini program runtime themes load from `https://www.awalon.top/mp-assets`.

Expected logical layout:

- default skin (`dark-gold`)
  - `/in-game-bg-optimized.jpg`
  - `/table.png`
  - `/quest-success-420x300.png`
  - `/quest-failed-420x300.png`
  - `/role-split/*.png`
- named skins
  - `/skins/<skin-id>/home-bg.jpg`
  - `/skins/<skin-id>/in-game-bg.jpg`
  - `/skins/<skin-id>/table.png`
  - `/skins/<skin-id>/quest-success.png`
  - `/skins/<skin-id>/quest-fail.png`
  - `/skins/<skin-id>/role-split/*.png`
  - optional skin UI/font files under `/skins/<skin-id>/ui/` and `/skins/<skin-id>/fonts/`

### Server-side tool workspace

Local server tool data lives under `public/tools/skin-assets/`.

Current layout:

- `generated/<skin-id>/`
  - latest generated assets from the skin studio
- `ref-imgs/<skin-id>/`
  - uploaded reference images

The server also exposes built-in dark-gold URLs under:

- `/tools/skin-assets/dark-gold/assets/*`
- `/tools/skin-assets/dark-gold/roles/*`

Those are a path contract in `server/index.js`. They are not yet backed by a
complete local asset tree in this repo.

### Rule of thumb

- Runtime-facing theme art belongs to the CDN asset contract.
- Iteration output and skin studio artifacts belong to `design-preview/assets/`
  or `public/tools/skin-assets/`.
- Do not store generated preview images under `mobile/miniprogram/assets/`.
