# Mini Dev-Centric Browser

A developer-focused desktop browser that combines everyday browsing with focused tools for debugging, inspection, and API work.

## Highlights

- Multi-panel workspace for Console, Network, Device Simulation, Git, API testing, AI assistance, and settings
- Electron desktop shell with a React and Vite renderer
- Monaco-powered editor experiences
- Simple Git integration for project workflows
- Configurable behavior through `app-config.json`

## Technology

- Electron
- React and Vite
- TypeScript/JavaScript
- Monaco Editor
- `simple-git`

## Local development

```bash
npm install
npm run dev
```

The development command starts Vite and launches Electron after the renderer is ready.

## Build

```bash
npm run build
```

The project uses Electron Builder for packaging. On Windows, packaging may require Developer Mode for symlink support.

## Project structure

- `main.js` — Electron main process
- `preload.js` and `webview-preload.js` — renderer bridges
- `src/` — React renderer and tool panels
- `app-config.json` — application configuration

This is an experimental developer-tool project; interfaces and panels may continue to change.
