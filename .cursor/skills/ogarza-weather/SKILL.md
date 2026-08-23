---
name: ogarza-weather
description: Edit the ogarza.weather Omarchy overlay plugin (shaders, Follow mapping, compositor, panel). Use when changing weather effects, mixes, WMO/wttr maps, Service.qml fades, or plugin docs.
---

# ogarza.weather changes

1. Read [AGENTS.md](../../../AGENTS.md) (repo root).
2. Touch the smallest file:
    - Maps / modes / panel fields → `Model.js` (`tweakFields`, `fieldsForPanel`)
    - Overlay, fetch, fade → `Service.qml`
    - Panel copy / layout → `Panel.qml` (params right column)
    - Look of an effect → `shaders/<name>.frag`
3. Mix recipe: add to `mixRecipes`, `modes`, `modeValues`, `exclusivePresets` (no fire, rainbow, or custom in Follow).
4. After `.frag` change, compile or rely on `scanShaders`. Wire new look knobs through existing uniforms when possible; keep the std140 block aligned. If Stormy goes blank, the fragment stage failed at runtime — do not add arrays / midpoint bolt builders (see `shaders.mdc`).
5. User-facing behavior → `README.md` + `CHANGELOG.md` + `manifest.json` version (see `.cursor/rules/docs.mdc`).

Do not re-fetch weather in the agent unless debugging Follow. IPC: `omarchy-shell ogarza.weather overlay`.
