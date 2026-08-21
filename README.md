# Omarchy Weather Effects

Fullscreen weather overlays for [Omarchy](https://omarchy.org/) — rain on glass, snow, fog, sun glow, storms, and fire drawn as transparent Wayland layer-shell shaders on top of your desktop.

Plugin id: `ogarza.weather` · version **1.4.1**

The bar uses a sparkles glyph so it does not look like a second copy of Omarchy’s built-in weather widget. Weather icons still appear inside the panel for each mode.

## Install

```bash
omarchy plugin add https://github.com/ogarza/omarchyweathereffects.git --enable
```

That clones into `~/.config/omarchy/plugins/ogarza.weather/` and places the bar widget (default: right section). To enable later:

```bash
omarchy plugin enable ogarza.weather --section right
```

Update or remove:

```bash
omarchy plugin update ogarza.weather
omarchy plugin remove ogarza.weather
```

## Usage

- **Left-click** the bar icon → open the panel (modes + tweaks)
- **Right-click** → toggle the overlay on/off

### Modes

| Mode | Effect |
|------|--------|
| Rain | Rain-on-glass drops and trails |
| Snow | Falling snow |
| Cloud/Fog | Soft fog / overcast haze |
| Sunny | Warm sun glow by day, cool moonlight after sunset |
| Stormy | Heavy weather + lightning |
| Fire | Ground fire (manual only — not used by Follow or Exclusive) |
| Follow | Matches current weather for your Omarchy location |
| Exclusive | Same weather source as Follow, but only one type is tracked |

In **Follow**, the plugin reads `~/.local/state/omarchy/settings/weather.json` (same location Omarchy weather uses). With coordinates it queries [Open-Meteo](https://open-meteo.com/); otherwise it falls back to [wttr.in](https://wttr.in/). Conditions refresh about every 15 minutes. Follow only selects rain, snow, fog, sunny, or stormy — never fire. Clear skies use sunlight during the day and moonlight after sunset at that location.

**Exclusive** uses that same fetch, then hides the overlay unless the live condition matches the type you pick under **Track only** (for example snow). Turn the overlay on, choose Exclusive, then choose the type — rain, snow, fog, sunny, or stormy. While the panel is open, Exclusive previews the tracked effect so you can tweak it. After you close the panel, the overlay stays up only when that weather is actually happening (`waiting` until then).

### Tweaks

Per-mode sliders in the panel (persisted in shell config):

- **Strength** — overall intensity (all modes)
- **Density** / **Speed** — coverage and motion (rain, snow, fog, stormy, fire).
- **Scale** — drop / snowflake / flame size (rain, snow, stormy, fire)
- **Glow** — sun bloom (sunny) or fire brightness (fire)
- **Position** / **Distance** — Sunny/Moonlight only. The sun or moon stays above the screen; Position sweeps past the left and right edges; Distance is 3D depth that opens or closes the ray cone
- **Lightning** — flash intensity (stormy)
- **Reset to defaults** — restores every mode’s sliders to 100% (does not change the selected mode)

## Requirements

- A strong GPU — these are fullscreen fragment shaders and can be demanding
- Omarchy with `omarchy-shell` (Quickshell)
- `curl` (Follow and Exclusive)
- Qt 6 `qsb` at `/usr/lib/qt6/bin/qsb` — fragment shaders are compiled to `.qsb` on load when missing or newer than the source

## Shaders

Sources live in `shaders/`:

- `rain.frag` / `snow.frag` / `fog.frag` / `sunny.frag` / `stormy.frag` / `fire.frag`

Prebuilt `.qsb` files are generated locally and gitignored; editing a `.frag` rebuilds its `.qsb` the next time the service scans.

## Changelog

### 1.4.1

- Fire shader compiles again (comment header was missing a slash)

### 1.4.0

- Exclusive mode: track a single weather type; overlay only when it matches; live preview while the panel is open
- Sunny/Moonlight Position and Distance sliders (sun stays above the screen; Distance opens or closes the ray cone)
- Higher Density cap for rain and stormy (240%)
- Reset to defaults in the panel
- Distinct sparkles bar icon (not a weather glyph)
- Compiled `.qsb` shaders are gitignored and rebuilt from `.frag` on load

### 1.3.0

- Added Sunny/Moonlight switch depending on sun position at location

## License

Original work is MIT — see [LICENSE](LICENSE).

Rain and fire shaders include third-party material that is **not** covered by that MIT grant. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
