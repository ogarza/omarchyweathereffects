# Omarchy Weather Effects

Fullscreen weather overlays for [Omarchy](https://omarchy.org/) — rain on glass, snow, fog, sun glow, storms, and fire drawn as transparent Wayland layer-shell shaders on top of your desktop.

Plugin id: `ogarza.weather`

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
| Sunny | Warm sun glow |
| Stormy | Heavy weather + lightning |
| Fire | Ground fire (manual only — not used by Follow) |
| Follow | Matches current weather for your Omarchy location |

In **Follow**, the plugin reads `~/.local/state/omarchy/settings/weather.json` (same location Omarchy weather uses). With coordinates it queries [Open-Meteo](https://open-meteo.com/); otherwise it falls back to [wttr.in](https://wttr.in/). Conditions refresh about every 15 minutes. Follow only selects rain, snow, fog, sunny, or stormy — never fire.

### Tweaks

Per-mode sliders in the panel (persisted in shell config):

- **Strength** — overall intensity (all modes)
- **Density** / **Speed** — coverage and motion (rain, snow, fog, stormy, fire)
- **Scale** — drop / snowflake / flame size (rain, snow, stormy, fire)
- **Glow** — sun bloom (sunny) or fire brightness (fire)
- **Lightning** — flash intensity (stormy)

## Requirements

- A strong GPU — these are fullscreen fragment shaders and can be demanding
- Omarchy with `omarchy-shell` (Quickshell)
- `curl` (Follow mode)
- Qt 6 `qsb` at `/usr/lib/qt6/bin/qsb` — fragment shaders are compiled to `.qsb` on load when missing or newer than the source

## Shaders

Sources live in `shaders/`:

- `rain.frag` / `snow.frag` / `fog.frag` / `sunny.frag` / `stormy.frag` / `fire.frag`

Prebuilt `.qsb` files are included; editing a `.frag` rebuilds its `.qsb` the next time the service scans.

## License

MIT — see [LICENSE](LICENSE).
