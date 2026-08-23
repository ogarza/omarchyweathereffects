import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Ui
import qs.Commons
import "Model.js" as Model

Item {
  id: root

  property var shell: null
  property var manifest: null
  property var pluginRegistry: null

  readonly property string pluginId: "ogarza.weather"
  property bool active: false
  property string mode: "none"
  property string weatherPreset: ""
  property string exclusivePreset: "snow"
  property string customShaderA: "rain"
  property string customShaderB: "fog"
  property string customShaderC: "none"
  property string quality: "high"
  readonly property real qualityScale: Model.qualityScale(root.quality)
  readonly property bool qualityDownscale: root.quality !== "extreme"
  property var shaderFiles: []
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
      active: root.active
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
      root.params = Model.mergeParams(entry.params)
    }
    root.persistLoaded = true
    if (root.liveWeatherMode) Qt.callLater(root.refreshWeather)
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
    settings.params = root.params
    delete settings.customShader
    shell.updateEntryInline(pluginId, settings)
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
  }

  function refreshWeather() {
    if (!root.liveWeatherMode) return
    if (!root.locationReady) return

    var lat = parseFloat(String(root.configuredLocationState.latitude))
    var lon = parseFloat(String(root.configuredLocationState.longitude))
    if (!isNaN(lat) && !isNaN(lon)) {
      if (openMeteoProc.running) return
      var url = "https://api.open-meteo.com/v1/forecast"
        + "?latitude=" + encodeURIComponent(String(lat))
        + "&longitude=" + encodeURIComponent(String(lon))
        + "&current=weather_code"
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
  Component.onCompleted: {
    scanShaders()
    Qt.callLater(function() {
      if (!root.persistLoaded) root.persistLoaded = true
      root.syncOverlayLayers()
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
    visible: fade > 0.001 && shaderFile !== ""
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
    property real density: Model.paramValue(root.params, preset || "rain", "density", 1)
    property real speed: Model.paramValue(root.params, preset || "rain", "speed", 1)
    property real scale: Model.paramValue(root.params, preset || "rain", "scale", 1)
    property real glow: Model.paramValue(root.params, preset || "sunny", "glow", 1)
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
      if (root.liveWeatherMode) root.refreshWeather()
    }
    onLoadFailed: {
      root.configuredLocationState = Model.parseLocationFile("")
      root.locationReady = true
      if (root.liveWeatherMode) root.refreshWeather()
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
    onTriggered: if (root.liveWeatherMode) root.refreshWeather()
  }

  Timer {
    interval: 15 * 60 * 1000
    running: root.liveWeatherMode
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
