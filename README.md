# FRAMEFALL

FRAMEFALL is a short, atmospheric 2D pixel-game portfolio. Follow the cursor to move, left-click to jump, and uncover three portfolio cards by exploring the surface and the cave below it.

The project is a complete front-end vertical slice: no server, database, external sprites, fonts, or audio files are required. Placeholder art is generated at runtime and placeholder sound uses Web Audio, so the first run is immediately playable.

## Live Demo

https://totozZ.github.io/Framefall/

## Stack

- Vite
- TypeScript (strict)
- Phaser 3 / WebGL
- HTML + CSS overlay cards
- GLSL reference shaders and a lightweight CSS CRT pass

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. Desktop Chrome, Firefox, or Edge with a mouse is recommended.

## Production build

```bash
npm run build
```

The deployable site is generated in `dist/`.

## Customize the portfolio

- Replace card copy and links in `src/game/config/content.ts`.
- Tune movement, CRT, water, lighting, camera, and event timing in `src/game/config/constants.ts`.
- Runtime placeholders use stable texture keys, so generated textures can later be replaced with loaded sprite sheets without changing scene flow.

## GitHub Pages

The included workflow deploys every push to `main` through GitHub Pages Actions.

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main`, or run the workflow manually.

`vite.config.ts` uses `base: '/Framefall/'`, matching this repository's GitHub Pages project path.

## Controls

- Move the mouse left/right of the rabbit to steer.
- Move it farther away to approach maximum speed.
- Left-click to jump (with jump buffering and coyote time).
- Portfolio cards only close through their **×** button.
