# Omarchy Weather Effects

Fullscreen weather overlays for [Omarchy](https://omarchy.org/) — rain on glass, snow, fog, sun glow, storms, fire, rainbow, and shader mixes — drawn as transparent Wayland layer-shell shaders on top of your desktop.

Plugin id: `ogarza.weather` · version **1.5.0**

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

- **Left-click** the bar icon → open the panel (quality and modes on the left, parameters on the right)
- **Right-click** → toggle the overlay on/off

**Quality** (Low / Medium / High / Extreme; **High is the default**) does two things. It renders the overlay at a fraction of the screen and scales it up (High is 75% of native pixels; Extreme is full resolution with no extra blit). Shader detail: Low and Medium simplify noise, layers, and highlights. **High matches the original effects.** Extreme adds a bit more (extra FBM octave, more snow/motes, a tighter glow term, a third rain layer, finer lightning). Mixes can run up to six fullscreen passes during a fade.

Switching modes in the panel **crossfades in 2 seconds**. Follow forecast changes fade over **10 seconds**.

### Modes

| Mode | Effect |
|------|--------|
| None | No overlay (default) |
| Rain | Rain-on-glass drops and trails |
| Snow | Falling snow |
| Cloud/Fog | Soft FBM clouds |
| Sunny | Warm sun glow by day, cool moonlight after sunset |
| Partly cloudy | Clouds + sun (per-layer strength) |
| Overcast | Heavy clouds + faint sun |
| Sun shower | Sun + rain (optional rainbow like every other condition) |
| Moonlit clouds | Clouds + moon (night look) |
| Drizzle | Haze + light rain |
| Snow squall | Haze + snow |
| Wintry mix | Rain + snow |
| Stormy | Diagonal rain, lightning, and a brief sky flash |
| Follow | Matches current weather for your Omarchy location |
| Exclusive | Same weather source as Follow, but only one type is tracked |
| Fire | Ground fire (manual only — not used by Follow or Exclusive) |
| Rainbow | Primary and secondary bows (manual only — not used by Follow or Exclusive) |
| Custom | Mix up to three shaders; any layer can be None (manual only — not used by Follow or Exclusive) |

The panel lists forecast modes first, then a **Manual only** separator for Fire, Rainbow, and Custom. Parameters for each layer open in columns to the right (mixes get one column per layer; **Add Rainbow** expands a Rainbow column). In Custom, Layer A / B / C pickers are stacked (each can be **None**), then those columns. Single modes show Strength plus that effect’s tweaks in the first column.

In **Follow**, the columns to the right show parameters for the **live condition**. In **Exclusive**, **Track only** sits immediately to the right of the mode list, then the tracked effect’s parameter columns (the same one previewed while the panel is open).

In **Follow**, the plugin reads `~/.local/state/omarchy/settings/weather.json` (same location Omarchy weather uses). With coordinates it queries [Open-Meteo](https://open-meteo.com/) **current** `weather_code` (not the daily outlook). Without coordinates it falls back to [wttr.in](https://wttr.in/). Refresh is about every 15 minutes. Follow never selects fire, rainbow, or custom. Clear (WMO 0) is sunny; 1–2 is partly cloudy, or moonlit clouds after sunset; drizzle / squall / wintry mix / overcast map to the mix modes; thunder is stormy.

**Exclusive** uses that same fetch, then hides the overlay unless the live condition matches **Track only**. While the panel is open, Exclusive previews the tracked effect. After you close the panel, the overlay stays up only when that weather is actually happening (`waiting` until then). Partly cloudy and moonlit clouds count as a match for each other.

### Tweaks

Columns to the right of the mode list show a short description and the sliders for that visual (or the Follow / Exclusive condition), one column per layer. Values persist in shell config.

- **Strength** — overall intensity (single-shader modes)
- **Clouds / Sun / Moon / Rain / Snow / Haze / Layer A / B / C** — mix layer strengths
- **Add Rainbow** — optional rainbow on any other condition (off by default)
- **Density** / **Speed** — coverage and motion
- **Scale** / **Size** — drop, flake, flame, cloud, or rainbow size (rain and stormy drop scale max 100%; rainbow Size max 400%)
- **Sheen** — rain glints
- **Brightness** — snow flake brightness
- **Glow** — sun bloom, fire, or rainbow brightness
- **Vividness** — rainbow band strength
- **Dust** — sunny/moonlight motes
- **Position** / **Distance** — sun/moon placement
- **Horizontal** / **Height** / **Distance** — rainbow placement (Height −200% to 200%)
- **Shimmer** — rainbow motion
- **Angle** — storm drop lean (100% is the classic diagonal)
- **Flash** — storm bolt and sheet-flash brightness
- **Frequency** — how often storm bolts strike
- **Gloom** — storm dark wash
- **Reset to defaults** — restores every mode’s parameters (does not change the selected mode or quality)

Shader-specific fields (rain density, fog size, and so on) are shared: editing rain density from Drizzle also affects standalone Rain.

### CLI (debug)

```bash
omarchy-shell ogarza.weather preview rain
omarchy-shell ogarza.weather overlay
omarchy-shell ogarza.weather quality medium
```

`preview` forces Follow to that preset (and fades). `overlay` prints compositor state. `quality` sets Low / Medium / High / Extreme.

## Requirements

- A GPU — fullscreen fragment shaders; mixes use two or three passes (up to six during a fade). Use Quality if the overlay is heavy.
- Omarchy with `omarchy-shell` (Quickshell)
- `curl` (Follow and Exclusive)
- Qt 6 `qsb` at `/usr/lib/qt6/bin/qsb` — fragment shaders are compiled to `.qsb` on load when missing or newer than the source

## Shaders

Sources live in `shaders/`:

- `rain.frag` / `snow.frag` / `fog.frag` / `sunny.frag` / `stormy.frag` / `fire.frag` / `rainbow.frag`

Prebuilt `.qsb` files are generated locally and gitignored; editing a `.frag` rebuilds its `.qsb` the next time the service scans.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

Original work is MIT — see [LICENSE](LICENSE).

Rain, storm lightning, and fire shaders include third-party material that is **not** covered by that MIT grant. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
