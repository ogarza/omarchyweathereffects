import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import Quickshell.Wayland
import qs.Ui
import qs.Commons
import "Model.js" as Model
import "HyprShader.js" as HyprShader

Item {
  id: root

  property var shell: null
  property var manifest: null
  property var pluginRegistry: null

  readonly property string pluginId: "ogarza.weather"
  readonly property string home: Quickshell.env("HOME")
  readonly property string hyprStateRoot: (Quickshell.env("XDG_STATE_HOME") || (home + "/.local/state")) + "/ogarza.weather"
  readonly property string hyprShaderPath: hyprStateRoot + "/current.frag"
  property bool active: false
  property string mode: "none"
  property string weatherPreset: ""
  property string exclusivePreset: "snow"
  property string customShaderA: "rain"
  property string customShaderB: "fog"
  property string customShaderC: "none"
  property string quality: "high"
  property bool hyprEnabled: true
  readonly property real qualityScale: Model.qualityScale(root.quality)
  readonly property bool qualityDownscale: root.quality !== "extreme"
  property var shaderFiles: []
  property var hyprShaderRivals: []
  readonly property string hyprShaderRivalWarning: Model.hyprShaderRivalWarning(root.hyprShaderRivals)
  property var params: Model.mergeParams(null)
  property bool panelOpen: false

  readonly property bool liveWeatherMode: Model.isLiveWeatherMode(root.mode)

  readonly property bool exclusiveMatch: {
    if (root.mode !== "exclusive") return true
    if (root.weatherPreset === root.exclusivePreset) return true
    var a = root.exclusivePreset
    var b = root.weatherPreset
    return (a === "partly" && b === "moonlit") || (a === "moonlit" && b === "partly")
  }

  readonly property bool exclusivePreview: root.mode === "exclusive" && root.panelOpen

  property bool persistLoaded: false
  property int hyprBaseDamage: -1
  property bool hyprApplied: false
  property int hyprGeneration: 0
  property int hyprAppliedGeneration: 0

  readonly property real hyprPixelRatio: {
    var screens = Quickshell.screens
    var dpr = 1
    if (screens) {
      for (var i = 0; i < screens.length; i++) {
        var scr = screens[i]
        if (scr && scr.devicePixelRatio)
          dpr = Math.max(dpr, Number(scr.devicePixelRatio))
      }
    }
    return Math.max(1, dpr)
  }

  readonly property bool overlayWanted: {
    if (!root.persistLoaded) return false
    if (!root.active && !root.exclusivePreview) return false
    if (root.mode === "none") return false
    if (root.mode === "follow" && !root.weatherPreset) return false
    if (root.mode === "exclusive" && !root.exclusiveMatch && !root.exclusivePreview) return false
    return true
  }

  readonly property bool overlayVisible: root.overlayWanted
    || (overlayFade.running && (Model.isVisualPreset(root.overlayFromPreset) || Model.isVisualPreset(root.overlayToPreset)))

  readonly property string hyprKind: Model.screenShaderKind(
    root.overlayToPreset, root.params, root.customShaderA, root.customShaderB, root.customShaderC, root.outdoorTempC)

  readonly property bool needsScreenShader: root.persistLoaded && root.hyprEnabled && root.overlayWanted && root.hyprKind !== ""

  readonly property bool hyprRainLive: root.needsScreenShader && root.hyprKind.indexOf("rain") !== -1

  readonly property bool hyprTick: root.needsScreenShader || root.hyprApplied

  readonly property string effectivePreset: {
    if (root.mode === "follow") return root.weatherPreset || "sunny"
    if (root.mode === "exclusive") return root.exclusivePreset
    return root.mode
  }

  readonly property string shaderFileName: Model.shaderFileForMode(root.mode, root.weatherPreset, root.exclusivePreset)

  readonly property url shaderUrl: Qt.resolvedUrl("shaders/" + shaderFileName)

  readonly property string shaderDirPath: Model.fileUrlToPath(Qt.resolvedUrl("shaders"))

  // Two-layer compositor: mix 0 = from, 1 = to. Retargets mid-fade instead of stacking.
  property string overlayFromPreset: ""
  property string overlayToPreset: ""
  property real overlayMix: 1
  property bool overlayPrimed: false
  readonly property int overlayFollowCrossfadeMs: 10000
  readonly property int overlayPanelCrossfadeMs: 2000
  property int overlayFadeDurationMs: 10000

  function applyOverlayFadeDuration() {
    root.overlayFadeDurationMs = root.mode === "follow"
      ? root.overlayFollowCrossfadeMs
      : root.overlayPanelCrossfadeMs
  }

  function targetVisualPreset() {
    if (!root.overlayWanted) return "none"
    if (root.mode === "follow") return root.weatherPreset || "none"
    if (root.mode === "exclusive") return root.exclusivePreset
    return root.mode
  }

  function snapOverlay(preset) {
    var next = String(preset || "none")
    overlayFade.stop()
    overlayFade.from = 0
    overlayFade.to = 1
    root.overlayFromPreset = next
    root.overlayToPreset = next
    root.overlayMix = 1
  }

  function reverseOverlayFade() {
    overlayFade.stop()
    var priorTo = root.overlayToPreset
    root.overlayToPreset = root.overlayFromPreset
    root.overlayFromPreset = priorTo
    var mix = 1.0 - root.overlayMix
    root.overlayMix = mix
    root.applyOverlayFadeDuration()
    overlayFade.from = mix
    overlayFade.to = 1
    overlayFade.start()
  }

  function beginOverlayCrossfade(preset) {
    var next = String(preset || "none")
    if (!root.overlayToPreset) {
      root.snapOverlay(next)
      return
    }
    if (next === root.overlayToPreset) {
      if (root.overlayMix >= 1 || overlayFade.running)
        return
    }
    if (next === root.overlayFromPreset && overlayFade.running) {
      root.reverseOverlayFade()
      return
    }
    var from = root.overlayMix >= 0.5 ? root.overlayToPreset : root.overlayFromPreset
    if (from === next && !overlayFade.running) {
      root.snapOverlay(next)
      return
    }
    overlayFade.stop()
    root.overlayFromPreset = from
    root.overlayToPreset = next
    root.overlayMix = 0
    root.applyOverlayFadeDuration()
    overlayFade.from = 0
    overlayFade.to = 1
    overlayFade.start()
  }

  function syncOverlayLayers() {
    if (!root.persistLoaded) {
      root.snapOverlay("none")
      return
    }
    var next = root.targetVisualPreset()
    if (!root.overlayPrimed) {
      root.snapOverlay(next)
      root.overlayPrimed = true
      return
    }
    root.beginOverlayCrossfade(next)
  }

  function overlayDebugState() {
    return JSON.stringify({
      mode: root.mode,
      weather: root.weatherPreset,
      source: root.weatherSource,
      from: root.overlayFromPreset,
      to: root.overlayToPreset,
      mix: Math.round(root.overlayMix * 1000) / 1000,
      fading: overlayFade.running,
      primed: root.overlayPrimed,
      quality: root.quality,
      scale: root.qualityScale,
      active: root.active,
      hyprEnabled: root.hyprEnabled,
      hypr: root.hyprKind,
      hyprApplied: root.hyprApplied,
      hyprDamage: root.needsScreenShader ? 0 : root.hyprBaseDamage,
      outdoorC: isNaN(root.outdoorTempC) ? null : Math.round(root.outdoorTempC * 10) / 10
    })
  }

  function previewPreset(preset) {
    var next = Model.normalizedMode(preset)
    if (next === "follow" || next === "exclusive" || next === "custom" || !Model.hasTweaks(next))
      return "unknown-preset"
    if (!root.active)
      root.setActive(true)
    if (root.mode !== "follow") {
      root.mode = "follow"
      root.persistSettings()
    }
    if (root.weatherPreset === next && root.overlayToPreset === next && root.overlayMix >= 1)
      return "already " + next
    root.weatherPreset = next
    return "ok " + next
  }

  readonly property string paramPreset: {
    var p = root.effectivePreset
    return (p === "rain" || p === "snow" || p === "fog" || p === "sunny" || p === "stormy" || p === "fire" || p === "rainbow") ? p : ""
  }

  readonly property real uStrength: Model.paramValue(root.params, root.paramPreset || "rain", "strength", 1)
  readonly property real uDensity: Model.paramValue(root.params, root.paramPreset || "rain", "density", 1)
  readonly property real uSpeed: Model.paramValue(root.params, root.paramPreset || "rain", "speed", 1)
  readonly property real uScale: Model.paramValue(root.params, root.paramPreset || "rain", "scale", 1)
  readonly property real uGlow: Model.paramValue(root.params, root.paramPreset || "sunny", "glow", 1)
  readonly property real uLightning: Model.paramValue(root.params, root.paramPreset || "stormy", "lightning", 1)
  readonly property real uFrequency: Model.paramValue(root.params, root.paramPreset || "stormy", "frequency", 1)
  readonly property real uAzimuth: Model.paramValue(
    root.params,
    root.paramPreset === "stormy" || root.paramPreset === "rainbow" ? root.paramPreset : "sunny",
    "azimuth",
    root.paramPreset === "stormy" ? 1 : 1.2
  )
  readonly property real uDistance: Model.paramValue(root.params, root.paramPreset || "sunny", "distance", 1)

  readonly property string icon: {
    if (root.mode === "follow")
      return Model.iconForPreset(root.weatherPreset || "sunny", root.nightFactor)
    if (root.mode === "exclusive")
      return Model.iconForPreset(root.exclusivePreset, root.nightFactor)
    return Model.iconForPreset(root.mode, root.nightFactor)
  }

  readonly property string statusText: {
    if (root.mode === "exclusive") {
      var wanted = Model.labelForExclusivePreset(root.exclusivePreset, root.nightFactor)
      if (root.exclusivePreview && !root.exclusiveMatch)
        return "Ex. · " + wanted + " · preview"
      if (!root.active) return "Overlay off"
      if (!root.exclusiveMatch) return "Ex. · " + wanted + " · waiting"
      return "Ex. · " + wanted
    }
    if (!root.active) return "Overlay off"
    if (root.mode === "follow")
      return "Following · " + Model.labelForPreset(root.weatherPreset || "sunny", root.nightFactor)
    if (root.mode === "sunny") return Model.labelForPreset("sunny", root.nightFactor)
    return Model.labelForMode(root.mode)
  }

  readonly property string tooltipText: {
    var state = root.active ? "on" : "off"
    if (root.mode === "follow")
      return "ogarza.weather " + state + " · Follow · " + Model.labelForPreset(root.weatherPreset || "sunny", root.nightFactor)
    if (root.mode === "exclusive") {
      var wanted = Model.labelForExclusivePreset(root.exclusivePreset, root.nightFactor)
      var wait = root.exclusiveMatch ? "" : " · waiting"
      return "ogarza.weather " + state + " · Exclusive · " + wanted + wait
    }
    if (root.mode === "sunny")
      return "ogarza.weather " + state + " · " + Model.labelForPreset("sunny", root.nightFactor)
    return "ogarza.weather " + state + " · " + Model.labelForMode(root.mode)
  }

  property var configuredLocationState: ({ name: "", latitude: null, longitude: null, hasCoordinates: false })
  property bool locationReady: false
  property string weatherSource: ""
  property int weatherRetries: 0
  property real nightFactor: 0
  property real outdoorTempC: NaN
  readonly property bool needsOutdoorTemp: Model.sunnyHazeWanted(root.params)
  readonly property int weatherResponseMaxBytes: 262144

  function weatherFetchCommand(url, timeoutSec) {
    return ["bash", "-c",
      "set -euo pipefail; "
      + "curl -fsS --max-time \"$1\" --max-filesize \"$2\" -- \"$3\" | head -c \"$2\"",
      "ogarza.weather-fetch", String(timeoutSec), String(root.weatherResponseMaxBytes), url]
  }

  function consumeWeatherStdout(raw, parseFn, source) {
    raw = String(raw || "")
    if (raw.length >= root.weatherResponseMaxBytes) {
      root.scheduleWeatherRetry()
      return
    }
    raw = raw.trim()
    if (!raw) {
      root.scheduleWeatherRetry()
      return
    }
    var tempC = source === "wttr" ? Model.tempCFromWttrJson(raw) : Model.tempCFromOpenMeteoJson(raw)
    if (!isNaN(tempC)) root.outdoorTempC = tempC
    if (root.liveWeatherMode)
      root.applyWeatherPreset(Model.followDayNightPreset(parseFn(raw), root.nightFactor), source)
  }

  function configObject() {
    if (pluginRegistry && typeof pluginRegistry.shellConfigProvider === "function")
      return pluginRegistry.shellConfigProvider()
    return shell && shell.shellConfig ? shell.shellConfig : null
  }

  function currentEntry() {
    var config = configObject()
    if (!pluginRegistry || typeof pluginRegistry.findEntryLocation !== "function") return null
    var loc = pluginRegistry.findEntryLocation(config, pluginId)
    if (!loc || !loc.found) return null
    if (loc.kind === "bar") return config.bar.layout[loc.section][loc.index]
    if (loc.kind === "plugin") return config.plugins[loc.index]
    return null
  }

  function loadPersisted() {
    var entry = currentEntry()
    if (entry) {
      root.active = entry.active === true
      root.mode = Model.normalizedMode(entry.mode)
      root.exclusivePreset = Model.normalizedExclusivePreset(entry.exclusivePreset)
      root.customShaderA = Model.normalizedCustomLayer(entry.customShaderA, "rain")
      root.customShaderB = Model.normalizedCustomLayer(entry.customShaderB, "fog")
      var enableC = entry.params && entry.params.custom ? Number(entry.params.custom.enableC) : 0
      if (enableC < 0.5 && (entry.customShaderC === undefined || entry.customShaderC === "rainbow"))
        root.customShaderC = "none"
      else
        root.customShaderC = Model.normalizedCustomLayer(entry.customShaderC, "none")
      root.quality = Model.normalizedQuality(entry.quality)
      root.hyprEnabled = entry.hyprEnabled !== false
      root.params = Model.mergeParams(entry.params)
      if (typeof entry.hyprBaseDamage === "number")
        root.hyprBaseDamage = entry.hyprBaseDamage
    }
    root.persistLoaded = true
    if (root.hyprBaseDamage < 0) baselineProc.running = true
    else root.scheduleHyprSync()
    if (root.liveWeatherMode || root.needsOutdoorTemp) Qt.callLater(root.refreshWeather)
  }

  function persistSettings() {
    if (!shell || typeof shell.updateEntryInline !== "function") return
    var entry = currentEntry() || {}
    var settings = {}
    for (var key in entry) {
      if (key !== "id") settings[key] = entry[key]
    }
    settings.active = root.active
    settings.mode = root.mode
    settings.exclusivePreset = root.exclusivePreset
    settings.customShaderA = root.customShaderA
    settings.customShaderB = root.customShaderB
    settings.customShaderC = root.customShaderC
    settings.quality = root.quality
    settings.hyprEnabled = root.hyprEnabled
    settings.params = root.params
    settings.hyprBaseDamage = root.hyprBaseDamage
    delete settings.customShader
    shell.updateEntryInline(pluginId, settings)
  }

  function parseOnOffToggle(raw, current) {
    var v = String(raw || "").replace(/^\s+|\s+$/g, "").toLowerCase()
    if (!v) return current
    if (v === "toggle") return !current
    if (v === "off" || v === "0" || v === "false" || v === "no") return false
    if (v === "on" || v === "1" || v === "true" || v === "yes") return true
    return current
  }

  function parseIpcParam(preset, key, raw) {
    var text = String(raw || "").replace(/^\s+|\s+$/g, "")
    var k = String(key || "")
    if (k === "enableC") return root.parseOnOffToggle(text, false) ? 1 : 0
    var lower = text.toLowerCase()
    if (k === "temperature") {
      var imperial = /f$/.test(lower)
      var n = parseFloat(text)
      if (isNaN(n)) return Model.paramValue(root.params, preset, k, 32.2)
      if (imperial || n > 49) return (n - 32) * 5 / 9
      return n
    }
    if (/%$/.test(text)) return parseFloat(text) / 100
    return parseFloat(text)
  }

  function ipcPower(raw) {
    root.setActive(root.parseOnOffToggle(raw, root.active))
    return root.active ? "on" : "off"
  }

  function ipcMode(raw) {
    if (!String(raw || "").replace(/^\s+|\s+$/g, "")) return root.mode
    root.setMode(raw)
    return root.mode
  }

  function ipcTrack(raw) {
    if (!String(raw || "").replace(/^\s+|\s+$/g, "")) return root.exclusivePreset
    root.setExclusivePreset(raw)
    return root.exclusivePreset
  }

  function ipcLayer(slotRaw, shader) {
    var s = String(slotRaw || "").replace(/^\s+|\s+$/g, "").toLowerCase()
    var slot = 0
    if (s === "b" || s === "1") slot = 1
    else if (s === "c" || s === "2") slot = 2
    else if (s === "a" || s === "0" || s === "") slot = 0
    else return "unknown-layer"
    var current = slot === 2 ? root.customShaderC : (slot === 1 ? root.customShaderB : root.customShaderA)
    if (!String(shader || "").replace(/^\s+|\s+$/g, "")) return current
    root.setCustomShader(slot, shader)
    return slot === 2 ? root.customShaderC : (slot === 1 ? root.customShaderB : root.customShaderA)
  }

  function ipcParam(preset, key, value) {
    var mode = Model.normalizedMode(preset)
    if (!preset || !Model.hasTweaks(mode)) return "unknown-preset"
    var k = String(key || "")
    if (!k) return JSON.stringify(root.params[mode] || {})
    if (!String(value || "").replace(/^\s+|\s+$/g, ""))
      return String(Model.paramValue(root.params, mode, k, k === "enableC" ? 0 : 1))
    root.setParam(mode, k, root.parseIpcParam(mode, k, value), true)
    return String(Model.paramValue(root.params, mode, k, k === "enableC" ? 0 : 1))
  }

  function ipcReset() {
    root.resetParams()
    return "ok"
  }

  function ipcRefresh() {
    root.refreshWeather()
    return root.weatherPreset || "pending"
  }

  function resetParams() {
    root.params = Model.mergeParams(null)
    persistSettings()
  }

  function setParam(preset, key, value, persist) {
    var mode = Model.normalizedMode(preset)
    if (!Model.hasTweaks(mode)) return
    var clamped = Model.clampParam(key, value, mode)
    var current = Model.paramValue(root.params, mode, key, key === "enableC" ? 0 : 1)
    if (current === clamped) {
      if (persist !== false) persistSettings()
      return
    }
    var next = Model.mergeParams(root.params)
    next[mode][key] = clamped
    root.params = next
    if (persist !== false) persistSettings()
  }

  function nudgeParam(preset, key, dir, step) {
    var amount = parseFloat(step)
    if (isNaN(amount) || amount <= 0) {
      amount = (key === "enableC") ? 1 : ((key === "strength" || key === "strengthA" || key === "strengthB" || key === "strengthC") ? 0.05 : 0.1)
    }
    var current = Model.paramValue(root.params, Model.normalizedMode(preset), key, key === "enableC" ? 0 : 1)
    setParam(preset, key, current + dir * amount, true)
  }

  function setActive(value) {
    var next = !!value
    if (root.active === next) return
    root.active = next
    persistSettings()
  }

  function toggle() {
    setActive(!root.active)
  }

  function setQuality(value) {
    var next = Model.normalizedQuality(value)
    if (root.quality === next) return
    root.quality = next
    persistSettings()
  }

  function setHyprEnabled(value) {
    var next = !!value
    if (root.hyprEnabled === next) return
    root.hyprEnabled = next
    persistSettings()
  }

  function setMode(value) {
    var next = Model.normalizedMode(value)
    if (root.mode === next) {
      if (Model.isLiveWeatherMode(next)) root.refreshWeather()
      return
    }
    root.mode = next
    persistSettings()
    if (Model.isLiveWeatherMode(next)) root.refreshWeather()
  }

  function setExclusivePreset(value) {
    var next = Model.normalizedExclusivePreset(value)
    if (root.exclusivePreset === next) {
      if (root.mode === "exclusive") root.refreshWeather()
      return
    }
    root.exclusivePreset = next
    persistSettings()
    if (root.mode === "exclusive") root.refreshWeather()
  }

  function setCustomShader(slot, value) {
    var fallback = slot === 2 ? "none" : (slot === 1 ? "fog" : "rain")
    var next = Model.normalizedCustomLayer(value, fallback)
    if (slot === 2) {
      if (root.customShaderC === next) return
      root.customShaderC = next
    } else if (slot === 1) {
      if (root.customShaderB === next) return
      root.customShaderB = next
    } else {
      if (root.customShaderA === next) return
      root.customShaderA = next
    }
    persistSettings()
  }

  function scanShaders() {
    if (scanProc.running) return
    var dir = root.shaderDirPath
    if (!dir) return
    scanProc.command = ["bash", "-c",
      "dir=\"$1\"; qsb=/usr/lib/qt6/bin/qsb; shopt -s nullglob; "
      + "for f in \"$dir\"/*.frag; do out=\"${f}.qsb\"; "
      + "if [[ ! -f \"$out\" || \"$f\" -nt \"$out\" ]]; then \"$qsb\" --qt6 -o \"$out\" \"$f\" || true; fi; "
      + "done; for f in \"$dir\"/*.qsb; do basename -- \"$f\"; done",
      "ogarza.weather-scan", dir]
    scanProc.running = true
    root.scanHyprRivals()
  }

  function scanHyprRivals() {
    if (hyprRivalProc.running) return
    var dir = root.home + "/.config/omarchy/plugins"
    hyprRivalProc.command = ["bash", "-c",
      "root=\"$1\"; self=\"$2\"; shopt -s nullglob; "
      + "for dir in \"$root\"/*/; do "
      + "id=\"${dir%/}\"; id=\"${id##*/}\"; "
      + "case \"$id\" in \"$self\"|.*|*.bak*) continue ;; esac; "
      + "if grep -RIl --include='*.qml' --include='*.js' 'screen_shader' \"$dir\" >/dev/null 2>&1; then "
      + "name=\"$id\"; man=\"$dir/manifest.json\"; "
      + "if [[ -f \"$man\" ]]; then "
      + "n=$(sed -n 's/.*\"name\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p' \"$man\" | head -1); "
      + "[[ -n \"$n\" ]] && name=\"$n\"; fi; "
      + "printf '%s\\t%s\\n' \"$id\" \"$name\"; fi; done",
      "ogarza.weather-hypr-rivals", dir, root.pluginId]
    hyprRivalProc.running = true
  }

  function refreshWeather() {
    if (!root.liveWeatherMode && !root.needsOutdoorTemp) return
    if (!root.locationReady) return

    var lat = parseFloat(String(root.configuredLocationState.latitude))
    var lon = parseFloat(String(root.configuredLocationState.longitude))
    if (!isNaN(lat) && !isNaN(lon)) {
      if (openMeteoProc.running) return
      var url = "https://api.open-meteo.com/v1/forecast"
        + "?latitude=" + encodeURIComponent(String(lat))
        + "&longitude=" + encodeURIComponent(String(lon))
        + "&current=weather_code,temperature_2m"
        + "&forecast_days=1"
        + "&timezone=auto"
      openMeteoProc.command = root.weatherFetchCommand(url, 5)
      openMeteoProc.running = true
      return
    }

    if (openMeteoProc.running || wttrProc.running) return
    var query = Model.wttrLocationQuery(root.configuredLocationState.name, root.configuredLocationState.latitude, root.configuredLocationState.longitude)
    wttrProc.command = root.weatherFetchCommand("https://wttr.in/" + query + "?format=j1", 10)
    wttrProc.running = true
  }

  function applyWeatherPreset(preset, source) {
    var next = String(preset || "")
    var from = String(source || "")
    if (from === "wttr" && root.weatherSource === "open-meteo")
      return
    if (next === "") {
      if (!root.liveWeatherMode) return
      root.scheduleWeatherRetry()
      return
    }
    root.weatherRetries = 0
    root.weatherSource = from
    root.weatherPreset = next
  }

  function refreshNightFactor() {
    var loc = root.configuredLocationState
    root.nightFactor = Model.nightFactor(loc ? loc.latitude : null, loc ? loc.longitude : null, Date.now())
  }

  function scheduleWeatherRetry() {
    if (root.weatherRetries >= 3) return
    root.weatherRetries++
    weatherRetryTimer.restart()
  }

  // Omarchy's Lua parser: hyprctl keyword fails. One eval, two statements,
  // damage first — two processes race, and Lua table key order is unspecified.
  function hypr(lua) {
    Quickshell.execDetached(["hyprctl", "eval", lua])
  }

  function applyHypr(damage, shader) {
    root.hypr('hl.config({ debug = { damage_tracking = ' + Math.round(damage) + ' } }); '
      + 'hl.config({ decoration = { screen_shader = "' + shader + '" } })')
  }

  function hyprInput() {
    return Model.hyprShaderInput(
      root.overlayToPreset,
      root.params,
      root.quality,
      root.customShaderA,
      root.customShaderB,
      root.customShaderC,
      root.hyprPixelRatio,
      root.outdoorTempC
    )
  }

  function scheduleHyprSync() {
    hyprSyncTimer.restart()
  }

  function renderHypr() {
    if (!root.persistLoaded) return
    if (!root.needsScreenShader) {
      if (root.hyprApplied) root.clearHyprShader()
      return
    }
    var src = HyprShader.build(root.hyprInput())
    if (!src) {
      if (root.hyprApplied) root.clearHyprShader()
      return
    }
    root.hyprGeneration += 1
    hyprShaderFile.setText(src)
    hyprApplyFallback.restart()
  }

  function applyHyprRendered() {
    if (root.hyprAppliedGeneration === root.hyprGeneration) return
    if (!root.needsScreenShader) return
    root.hyprAppliedGeneration = root.hyprGeneration
    hyprApplyFallback.stop()
    root.applyHypr(0, root.hyprShaderPath)
    root.hyprApplied = true
  }

  function clearHyprShader() {
    hyprApplyFallback.stop()
    root.applyHypr(1, "")
    root.hyprApplied = false
    restoreDamageTimer.restart()
  }

  function reapplyHypr() {
    if (!root.needsScreenShader || !root.hyprApplied) return
    root.applyHypr(0, root.hyprShaderPath)
  }

  // createObject() runs onCompleted before the shell injects pluginRegistry.
  onPluginRegistryChanged: loadPersisted()
  onShellChanged: loadPersisted()
  onConfiguredLocationStateChanged: root.refreshNightFactor()
  onNightFactorChanged: {
    if (root.mode !== "follow") return
    var next = Model.followDayNightPreset(root.weatherPreset, root.nightFactor)
    if (next && next !== root.weatherPreset) root.weatherPreset = next
  }
  onEffectivePresetChanged: root.syncOverlayLayers()
  onModeChanged: root.syncOverlayLayers()
  onOverlayWantedChanged: root.syncOverlayLayers()
  onNeedsScreenShaderChanged: root.scheduleHyprSync()
  onOverlayToPresetChanged: root.scheduleHyprSync()
  onParamsChanged: root.scheduleHyprSync()
  onQualityChanged: root.scheduleHyprSync()
  onOutdoorTempCChanged: root.scheduleHyprSync()
  onNeedsOutdoorTempChanged: if (root.needsOutdoorTemp) root.refreshWeather()
  onCustomShaderAChanged: root.scheduleHyprSync()
  onCustomShaderBChanged: root.scheduleHyprSync()
  onCustomShaderCChanged: root.scheduleHyprSync()
  Component.onCompleted: {
    scanShaders()
    ensureHyprStateDir.running = true
    Qt.callLater(function() {
      if (!root.persistLoaded) root.persistLoaded = true
      root.syncOverlayLayers()
      root.scheduleHyprSync()
    })
  }

  NumberAnimation {
    id: overlayFade
    target: root
    property: "overlayMix"
    from: 0
    to: 1
    duration: root.overlayFadeDurationMs
    easing.type: Easing.InOutSine
  }

  component WeatherLayer: ShaderEffect {
    required property string visual
    required property int slot
    required property real fade
    required property var screenInfo

    readonly property string preset: Model.shaderForVisualSlot(visual, slot, root.customShaderA, root.customShaderB, root.customShaderC, root.params)
    readonly property string shaderFile: Model.shaderFileForPreset(preset)

    anchors.fill: parent
    blending: true
    visible: fade > 0.001 && shaderFile !== "" && !(preset === "rain" && root.hyprRainLive)
    opacity: Math.max(0, Math.min(1, fade))
    fragmentShader: shaderFile !== "" ? Qt.resolvedUrl("shaders/" + shaderFile) : ""
    property real time: clock.elapsedTime
    property vector2d resolution: Qt.vector2d(width, height)
    property real pixelRatio: {
      var scr = screenInfo
      var dpr = scr && scr.devicePixelRatio ? Number(scr.devicePixelRatio) : 1.0
      return Math.max(1.0, dpr * root.qualityScale)
    }
    property real strength: Model.slotStrength(root.params, visual, slot, root.customShaderA, root.customShaderB, root.customShaderC)
    property real density: {
      if (preset === "stormy" && root.hyprRainLive) return 0
      return Model.paramValue(root.params, preset || "rain", "density", 1)
    }
    property real speed: Model.paramValue(root.params, preset || "rain", "speed", 1)
    property real scale: Model.paramValue(root.params, preset || "rain", "scale", 1)
    property real glow: Model.paramValue(root.params, preset || "sunny", "glow", 1)
    property real sheen: Model.paramValue(root.params, preset === "stormy" ? "stormy" : "rain", "sheen", 0.6)
    property real lightning: Model.paramValue(root.params, preset || "stormy", "lightning", 1)
    property real frequency: Model.paramValue(root.params, preset || "stormy", "frequency", 1)
    property real azimuth: Model.paramValue(
      root.params,
      preset === "sunny" || preset === "stormy" || preset === "rainbow" ? preset : "sunny",
      "azimuth",
      preset === "stormy" ? 1 : 1.2
    )
    property real sunDistance: Model.paramValue(
      root.params,
      preset === "sunny" || preset === "rainbow" ? preset : "sunny",
      "distance",
      1
    )
    property real night: {
      if (preset === "rainbow") return root.nightFactor
      if (preset !== "sunny") return 0
      if (visual === "moonlit") return 1
      return root.nightFactor
    }
    property real quality: Model.qualityRank(root.quality)
  }

  FileView {
    path: Quickshell.env("HOME") + "/.local/state/omarchy/settings/weather.json"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      root.configuredLocationState = Model.parseLocationFile(text())
      root.weatherRetries = 0
      root.locationReady = true
      if (root.liveWeatherMode || root.needsOutdoorTemp) root.refreshWeather()
    }
    onLoadFailed: {
      root.configuredLocationState = Model.parseLocationFile("")
      root.locationReady = true
      if (root.liveWeatherMode || root.needsOutdoorTemp) root.refreshWeather()
    }
  }

  Process {
    id: scanProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.shaderFiles = Model.shaderFilesFromListing(text)
    }
  }

  Process {
    id: hyprRivalProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.hyprShaderRivals = Model.parseHyprShaderRivals(text)
    }
  }

  Process {
    id: openMeteoProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.consumeWeatherStdout(text, Model.presetFromOpenMeteoJson, "open-meteo")
    }
  }

  Process {
    id: wttrProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.consumeWeatherStdout(text, Model.presetFromWttrJson, "wttr")
    }
  }

  Timer {
    id: weatherRetryTimer
    interval: 2500
    onTriggered: if (root.liveWeatherMode || root.needsOutdoorTemp) root.refreshWeather()
  }

  Timer {
    interval: 15 * 60 * 1000
    running: root.liveWeatherMode || root.needsOutdoorTemp
    repeat: true
    onTriggered: {
      root.weatherRetries = 0
      root.refreshWeather()
    }
  }

  Timer {
    interval: 15000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refreshNightFactor()
  }

  FrameAnimation {
    id: clock
    running: root.overlayVisible
  }

  Process {
    id: ensureHyprStateDir
    command: ["mkdir", "-p", root.hyprStateRoot]
    running: false
    onExited: root.scheduleHyprSync()
  }

  Process {
    id: baselineProc
    running: false
    command: ["bash", "-c",
      "hyprctl getoption debug:damage_tracking -j | grep -o '\"int\": *[0-9-]*' | grep -o '[0-9-]*$'"]
    stdout: StdioCollector {
      onStreamFinished: {
        var v = parseInt(String(text || "").trim(), 10)
        if (root.hyprBaseDamage >= 0) return
        if (isNaN(v) || v < 0 || v === 0) root.hyprBaseDamage = 2
        else root.hyprBaseDamage = v
        root.persistSettings()
        root.scheduleHyprSync()
      }
    }
  }

  FileView {
    id: hyprShaderFile
    path: root.hyprShaderPath
    watchChanges: false
    atomicWrites: true
    printErrors: false
    onSaved: root.applyHyprRendered()
  }

  Timer {
    id: hyprSyncTimer
    interval: 120
    repeat: false
    onTriggered: root.renderHypr()
  }

  Timer {
    id: hyprApplyFallback
    interval: 90
    repeat: false
    onTriggered: root.applyHyprRendered()
  }

  Timer {
    id: restoreDamageTimer
    interval: 120
    repeat: false
    onTriggered: {
      if (root.needsScreenShader) return
      root.applyHypr(root.hyprBaseDamage >= 0 ? root.hyprBaseDamage : 2, "")
    }
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (String(event && event.name ? event.name : "") === "configreloaded")
        root.scheduleHyprSync()
    }
  }

  Variants {
    model: Quickshell.screens
    PanelWindow {
      required property var modelData
      screen: modelData
      visible: root.hyprTick
      color: "transparent"
      anchors { top: true; left: true }
      implicitWidth: 1
      implicitHeight: 1
      exclusiveZone: 0
      exclusionMode: ExclusionMode.Ignore
      WlrLayershell.namespace: "ogarza-weather-tick"
      WlrLayershell.layer: WlrLayer.Overlay
      WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
      mask: Region {}

      Rectangle {
        anchors.fill: parent
        color: ticker.odd ? "#01ffffff" : "#02ffffff"
      }

      FrameAnimation {
        id: ticker
        running: root.hyprTick
        property bool odd: false
        onTriggered: ticker.odd = !ticker.odd
      }
    }
  }

  Variants {
    model: Quickshell.screens

    PanelWindow {
      id: panel
      required property var modelData

      screen: modelData
      visible: root.overlayVisible && !remapGuard.remapping
      color: "transparent"
      anchors { top: true; bottom: true; left: true; right: true }

      ScreenMoveRemap {
        id: remapGuard
        window: panel
      }

      WlrLayershell.namespace: "posterectus"
      WlrLayershell.layer: WlrLayer.Overlay
      WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
      exclusionMode: ExclusionMode.Ignore
      mask: Region {}

      Item {
        id: fxStack
        anchors.fill: parent
        layer.enabled: root.qualityDownscale
        layer.live: true
        layer.smooth: true
        layer.textureSize: {
          var dpr = panel.screen && panel.screen.devicePixelRatio ? panel.screen.devicePixelRatio : 1
          var sz = Model.qualityTextureSize(width, height, dpr, root.quality)
          return Qt.size(sz.w, sz.h)
        }

        WeatherLayer {
          visual: root.overlayFromPreset
          slot: 0
          fade: 1 - root.overlayMix
          screenInfo: panel.screen
        }

        WeatherLayer {
          visual: root.overlayFromPreset
          slot: 1
          fade: 1 - root.overlayMix
          screenInfo: panel.screen
        }

        WeatherLayer {
          visual: root.overlayFromPreset
          slot: 2
          fade: 1 - root.overlayMix
          screenInfo: panel.screen
        }

        WeatherLayer {
          visual: root.overlayToPreset
          slot: 0
          fade: root.overlayMix
          screenInfo: panel.screen
        }

        WeatherLayer {
          visual: root.overlayToPreset
          slot: 1
          fade: root.overlayMix
          screenInfo: panel.screen
        }

        WeatherLayer {
          visual: root.overlayToPreset
          slot: 2
          fade: root.overlayMix
          screenInfo: panel.screen
        }
      }
    }
  }
}
