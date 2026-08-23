# ogarza.weather

Omarchy Quickshell plugin: fullscreen Wayland overlay shaders. Id `ogarza.weather`.

## Layout

| Path | Role |
|------|------|
| `Service.qml` | Overlay, fetch, persist, compositor |
| `Panel.qml` / `BarWidget.qml` | UI + IPC `ogarza.weather` |
| `Model.js` | Modes, mixes, WMO/wttr maps, params |
| `shaders/*.frag` | Effects; `qsb` → `*.frag.qsb` (gitignored) |

Do not edit `/usr/share/omarchy/`. Hot-reload on save under `~/.config/omarchy/plugins/`.

## Rules of thumb

- Overlay is premultiplied alpha. Uniform block must stay aligned across shaders (unused fields still listed). End the block with `float quality` (0–3).
- Follow/Exclusive: never fire, rainbow, or custom. Wait for `locationReady` before fetch. Open-Meteo if lat/lon; else wttr. Parse WMO `0` without `code \|\| ""`.
- Visual target is a mode id. Mixes use two or three shader slots + `strengthA`/`strengthB`/`strengthC`. Optional rainbow uses `enableC` on every visual except standalone rainbow. Custom layers persist `customShaderA` / `customShaderB` / `customShaderC` (`none` turns a slot off). Quality (`low`/`medium`/`high`/`extreme`) downscales the compositor stack (layer texture) except Extreme. Crossfade: `overlayFromPreset` → `overlayToPreset`, 10s follow / 2s panel.
- Default mode is `none`. First snap after persist load; then always fade.
- After `.frag` edits, next `scanShaders` rebuilds `.qsb`. **`qsb` OK ≠ overlay works.** Stormy lightning must stay scalar (`boltPoint` / `strokeChannel`). Arrays, `inout` point lists, midpoint-eval, and baked `const` tables all blanked the fullscreen ShaderEffect (rain included). See `.cursor/rules/shaders.mdc`.
- Panel: params in columns (`fieldsForVisualLayer` / `fieldsForPanel`). Follow uses `weatherPreset`; Exclusive uses `exclusivePreset`. Mixes edit layer strengths plus each layer shader’s params. User-facing changes also update README, CHANGELOG, and `manifest.json`.

## IPC

```
omarchy-shell ogarza.weather preview rain
omarchy-shell ogarza.weather overlay
omarchy-shell ogarza.weather quality high
```

## Skills / rules

- `.cursor/rules/` — conventions (always + shaders + docs).
- `.cursor/skills/ogarza-weather/` — change workflow.
