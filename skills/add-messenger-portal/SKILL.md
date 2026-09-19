---
name: add-messenger-portal
description: Add and verify a proximity-activated external domain entrance beside a building in this Messenger project. Use when a user wants another website link placed in the 3D planet scene.
---

# Add Messenger Portal

Add the requested website as a building-adjacent entrance on the current `/` experience. Entering the configured radius must reveal a link; it must never navigate automatically.

## Required inputs

Resolve these values before editing:

- Absolute `http` or `https` URL.
- Short display title used in `访问{title} ↗`.
- Chinese location label such as `咖啡店旁`.
- Scene direction vector. If the user names a building but gives no vector, calibrate it in the current scene rather than guessing.

Ask only when the requested building or title is genuinely ambiguous. Canonicalize the URL with `new URL(...).href`.

## Project invariants

- The source of truth for the current homepage is `src/lib/original/portals.json`.
- Do not edit generated files under `static/original`; `pnpm build` and `pnpm original:prepare` regenerate them.
- Do not add the entrance to `src/lib/messenger/portalConfig.ts`; that file belongs to the legacy `/prototype` route.
- `direction` points from the planet center to a walkable ground point and is normalized at runtime.
- Default to `radius: 2.5` and `openInNewTab: true` unless the user requests otherwise.
- Preserve existing entries and unrelated worktree changes. Reject duplicate IDs and destination URLs.

## Placement calibration

Prefer a point on walkable ground immediately in front of the named building.

1. Inspect `src/lib/original/dialogues.json` for an NPC attached to the building.
2. When there is a suitable NPC, run [scripts/direction-from-npc.mjs](scripts/direction-from-npc.mjs) against a running local preview. It enters the scene, places the player in front of that NPC, prints the normalized direction, and captures a screenshot.
3. Inspect the screenshot. Accept the vector only when the character is visibly beside the intended building and not inside geometry.
4. If the building has no suitable NPC, open `/?debug`, walk the character to the desired ground point, and copy the on-screen normalized `direction` value.

Example:

```sh
pnpm build
pnpm preview --host 127.0.0.1
PLAYWRIGHT_CHANNEL=chrome node skills/add-messenger-portal/scripts/direction-from-npc.mjs \
  --origin http://127.0.0.1:4173 \
  --npc chef \
  --screenshot /tmp/cafe-portal.png
```

The locator is read-only. Stop the preview after calibration.

## Add the configuration

Use [scripts/add-portal.mjs](scripts/add-portal.mjs) after the vector is confirmed. It validates and normalizes the values before appending one entry.

```sh
node skills/add-messenger-portal/scripts/add-portal.mjs \
  --id random-universe \
  --title 随机宇宙 \
  --location 咖啡店旁 \
  --url https://random-universe.zhihaojiang.com/ \
  --direction 0.75813469,0.64504465,0.09565142
```

Use `--dry-run` to print the proposed JSON without writing. Use `--radius <number>` or `--same-tab` only when requested.

## Keep browser coverage current

The portal loop in `scripts/verify-original.mjs` must include every configured portal. Prefer reading the entries from `src/lib/original/portals.json` so future additions are covered automatically. For each portal, verify:

- The link label is `访问{title} ↗`.
- `href` is the canonical destination and `target` matches `openInNewTab`.
- Entering the radius reveals the link.
- Moving outside the radius hides it.
- Clicking opens the intercepted destination without unexpectedly replacing the game page.

Tests must intercept external destinations; verification must not contact the configured websites.

## Verification

Run, at minimum:

```sh
pnpm check
pnpm build
PLAYWRIGHT_CHANNEL=chrome node scripts/verify-original.mjs http://127.0.0.1:4173
git diff --check
```

Start `pnpm preview --host 127.0.0.1` before the browser test and stop it afterward. Report portal-specific assertions separately if a later, unrelated part of the full original-engine suite fails; do not claim the whole suite passed in that case.
