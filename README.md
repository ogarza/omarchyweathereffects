# Omarchy Weather Effects

Fullscreen weather on your Omarchy desktop: rain on glass, snow, clouds, sun, storms, fire, rainbows, and mixes. Most of it is a transparent overlay. Rain refraction and heat haze go through Hyprland so they warp the real desktop, not a painted copy.

Plugin id: `ogarza.weather` · version **1.6.0**

## Install

```bash
omarchy plugin add https://github.com/ogarza/omarchyweathereffects.git --enable
```

That clones into `~/.config/omarchy/plugins/ogarza.weather/` and puts the widget on the bar (right section by default). To enable later:

```bash
omarchy plugin enable ogarza.weather --section right
```

Update:

```bash
omarchy plugin update ogarza.weather
```

### Uninstall

If the overlay or desktop warp was on when you removed the plugin, Hyprland can keep the last screen shader until you clear it. Settings live in the Omarchy shell plugin entry (not this repo). Generated files sit under the state directory.

```bash
omarchy plugin remove ogarza.weather

rm -rf "${XDG_STATE_HOME:-$HOME/.local/state}/ogarza.weather"

hyprctl eval 'hl.config({ decoration = { screen_shader = "" } })'
hyprctl eval 'hl.config({ debug = { damage_tracking = 2 } })'
```

The last two lines drop a leftover Hyprland shader and put damage tracking back to the usual full-monitor mode. Skip them if another plugin (Phosphor, for example) is supposed to own that slot.

## Usage

- **Left-click** the bar icon to open the panel (modes and quality on the left, sliders on the right).
- **Right-click** to turn the overlay on or off.

**Quality** (Low, Medium, High, Extreme) trades sharpness for cost. High is the default and looks good on most machines. Extreme is full resolution and a bit more shader work. If the desktop feels heavy, drop quality first.

**Desktop warp** is a global switch for Hyprland refraction and haze. On (the default) warps the real desktop. Off leaves those sliders alone but uses the painted overlay only, and clears the Hyprland shader if this plugin had applied it.

Mode changes in the panel fade over about two seconds. Follow fades forecast changes over about ten.

### Modes

| Mode | Effect |
|------|--------|
| None | Overlay off (default) |
| Rain | Drops on glass that refract the desktop (Refract 0 uses the painted look instead) |
| Snow | Falling snow |
| Cloud/Fog | Soft drifting clouds |
| Sunny | Warm glow by day, cooler light after sunset. Optional heat haze. |
| Partly cloudy | Clouds and sun |
| Overcast | Heavy clouds, faint sun |
| Sun shower | Sun and rain (optional rainbow, like every other condition) |
| Moonlit clouds | Clouds and moon |
| Drizzle | Light rain through haze |
| Snow squall | Snow through haze |
| Wintry mix | Rain and snow |
| Stormy | Diagonal rain with desktop refraction, lightning, and a sky flash |
| Follow | Matches current weather for your Omarchy location |
| Exclusive | Same weather source as Follow, but only one type is shown |
| Fire | Ground fire (manual only). Optional heat haze. |
| Rainbow | Primary and secondary bows (manual only) |
| Custom | Up to three stacked shaders; any layer can be None (manual only) |

The panel lists forecast modes first, then **Manual only** for Fire, Rainbow, and Custom. Mixes open one parameter column per layer. **Add Rainbow** adds a Rainbow column. Custom stacks Layer A / B / C pickers (each can be **None**).

**Follow** and **Exclusive** read `~/.local/state/omarchy/settings/weather.json` — the same location Omarchy uses. With coordinates they ask [Open-Meteo](https://open-meteo.com/) for the current weather code and outdoor temperature. Without coordinates they fall back to [wttr.in](https://wttr.in/). Refresh is about every 15 minutes. That temperature also gates sunny **Haze** when **On above** is set.

Follow never picks fire, rainbow, or custom. Clear sky is sunny. Partly cloudy becomes moonlit clouds after sunset. Thunder is stormy.

**Exclusive** uses the same fetch, then only shows the overlay when the live weather matches **Track only**. While the panel is open you can preview the tracked effect. After you close it, the overlay waits until that weather is actually happening. Partly cloudy and moonlit clouds count as a match for each other.

### Tweaks

Columns to the right of the mode list show a short description and the sliders for that look (or the Follow / Exclusive condition). Values persist in shell config.

- **Strength** — overall intensity on single-shader modes
- **Clouds / Sun / Moon / Rain / Snow / Haze / Layer A / B / C** — mix layer strengths
- **Add Rainbow** — optional rainbow on any other condition (off by default)
- **Density** / **Speed** — coverage and motion
- **Scale** / **Size** — drop, flake, flame, cloud, or rainbow size
- **Sheen** — glints on rain and storm drops
- **Refract** — warp the real desktop through rain or storm drops (Hyprland). Default 100%. 0 keeps the painted overlay
- **Haze** — heat shimmer on Sunny and Fire
- **On above** — outdoor temperature where sunny haze turns on (default 90°F / 32.2°C). Fire haze ignores this
- **Brightness** — snow flakes
- **Glow** — sun, fire, or rainbow brightness
- **Vividness** — rainbow bands
- **Dust** — motes in sunny / moonlight
- **Position** / **Distance** — sun and moon placement
- **Horizontal** / **Height** / **Distance** — rainbow placement
- **Shimmer** — rainbow motion
- **Angle** — how much storm rain leans
- **Flash** — lightning brightness
- **Frequency** — how often bolts strike
- **Gloom** — storm dark wash
- **Reset to defaults** — first control in the parameter column. Restores sliders for every mode; does not change the selected mode or quality

Shared shaders share sliders: changing rain density from Drizzle also changes standalone Rain.

## IPC

Quickshell exposes these under `ogarza.weather`. From a terminal:

```bash
omarchy-shell ogarza.weather <command> [args]
```

| Command | What it does |
|---------|----------------|
| `open` / `show` | Open the panel |
| `close` / `hide` | Close the panel |
| `toggle` | Open or close the panel |
| `power` / `active` `[on\|off\|toggle]` | Overlay on or off (same as right-click on the bar). No argument prints `on` or `off` |
| `mode` `[id]` | Set the mode (`rain`, `follow`, `custom`, …). No argument prints the current id |
| `track` / `exclusive` `[preset]` | Exclusive **Track only** (`rain`, `stormy`, …). No argument prints the current preset |
| `layer` `<a\|b\|c>` `[shader]` | Custom layer shader (`none` turns a slot off). No shader prints the current pick |
| `param` `<preset>` `<key>` `[value]` | Read or set a slider. Value is the stored number, or a percent (`80%`). `enableC` is `on`/`off`. Temperature is °C, or °F with an `F` suffix |
| `reset` | Restore every mode’s sliders (does not change mode, quality, or desktop warp) |
| `refresh` | Fetch Follow / Exclusive weather again |
| `preview <preset>` | Switch to Follow and fade to that look |
| `quality` `[level]` | Set `low`, `medium`, `high`, or `extreme`. No argument prints the current level |
| `hypr` `[on\|off\|toggle]` | Desktop warp. No argument prints `on` or `off` |
| `overlay` | Print compositor state (JSON) |

Examples:

```bash
omarchy-shell ogarza.weather power toggle
omarchy-shell ogarza.weather mode stormy
omarchy-shell ogarza.weather track snow
omarchy-shell ogarza.weather layer a rain
omarchy-shell ogarza.weather param rain refract 0
omarchy-shell ogarza.weather param sunny temperature 90F
omarchy-shell ogarza.weather reset
omarchy-shell ogarza.weather preview rain
omarchy-shell ogarza.weather quality high
omarchy-shell ogarza.weather hypr off
omarchy-shell ogarza.weather overlay
```

IPC `toggle` is the panel. `power` is the overlay.

## Desktop refraction (Hyprland)

With **Desktop warp** on, Rain or Stormy with **Refract** above 0, and Sunny or Fire with **Haze** above 0, apply a Hyprland screen shader at runtime. Hyprland only has one of those. If another plugin (Phosphor, for example) also sets it, whichever applied last wins.

On load and when the panel opens, this plugin scans the other folders under `~/.config/omarchy/plugins` for `.qml` / `.js` that mention `screen_shader`. It skips its own folder. If it finds a sibling, the panel shows a warning with that plugin’s name from `manifest.json`. It does not disable the other plugin or fight for the slot — it is only a heads-up that refraction or haze may disappear if the other shader applied last.

The generated file lives in `${XDG_STATE_HOME:-~/.local/state}/ogarza.weather/current.frag`. Nothing is written to `~/.config/hypr/`.

While refraction or haze is on, the monitor redraws every frame so the warp can animate. Clicks through a warped drop or the haze band land a little off from what you see.

A reboot clears the runtime shader. To drop it by hand from a TTY:

```bash
hyprctl eval 'hl.config({ decoration = { screen_shader = "" } })'
hyprctl eval 'hl.config({ debug = { damage_tracking = 2 } })'
```

Snow, fog, rainbow, and lightning stay on the overlay. When Hyprland is already drawing the rain, the overlay skips painted drops so they are not drawn twice.

## Requirements

- A GPU. Mixes use a few fullscreen passes; Refract and Haze add a Hyprland pass on the whole monitor. Use Quality if it feels heavy.
- Omarchy with `omarchy-shell` (Quickshell) and Hyprland
- `curl` for Follow and Exclusive
- Qt 6 `qsb` at `/usr/lib/qt6/bin/qsb` (overlay shaders compile on load when needed)

## Shaders

Overlay sources are in `shaders/` (`rain.frag`, `snow.frag`, `fog.frag`, `sunny.frag`, `stormy.frag`, `fire.frag`, `rainbow.frag`). The Hyprland shader is generated by `HyprShader.js`. Compiled `.qsb` files stay local and are rebuilt when you edit a `.frag`.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

Original work is MIT — see [LICENSE](LICENSE).

Rain, storm lightning, and fire include third-party material that is **not** covered by that MIT grant. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
