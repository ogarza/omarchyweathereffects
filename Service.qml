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
  property string mode: "rain"
  property string weatherPreset: ""
  property string exclusivePreset: "snow"
  property var shaderFiles: []
  property var params: Model.mergeParams(null)
  property bool panelOpen: false

  readonly property bool liveWeatherMode: Model.isLiveWeatherMode(root.mode)

  readonly property bool exclusiveMatch: root.mode !== "exclusive"
    || root.weatherPreset === root.exclusivePreset

  readonly property bool exclusivePreview: root.mode === "exclusive" && root.panelOpen

  readonly property bool overlayVisible: root.exclusivePreview
    || (root.active && root.exclusiveMatch)

  readonly property string effectivePreset: {
    if (root.mode === "follow") return root.weatherPreset || "sunny"
    if (root.mode === "exclusive") return root.exclusivePreset
    return root.mode
  }

  readonly property string shaderFileName: Model.shaderFileForMode(root.mode, root.weatherPreset, root.exclusivePreset)

  readonly property url shaderUrl: Qt.resolvedUrl("shaders/" + shaderFileName)

  readonly property string shaderDirPath: Model.fileUrlToPath(Qt.resolvedUrl("shaders"))

  readonly property string paramPreset: {
    var p = root.effectivePreset
    return (p === "rain" || p === "snow" || p === "fog" || p === "sunny" || p === "stormy" || p === "fire") ? p : ""
  }

  readonly property real uStrength: Model.paramValue(root.params, root.paramPreset || "rain", "strength", 1)
  readonly property real uDensity: Model.paramValue(root.params, root.paramPreset || "rain", "density", 1)
  readonly property real uSpeed: Model.paramValue(root.params, root.paramPreset || "rain", "speed", 1)
  readonly property real uScale: Model.paramValue(root.params, root.paramPreset || "rain", "scale", 1)
  readonly property real uGlow: Model.paramValue(root.params, root.paramPreset || "sunny", "glow", 1)
  readonly property real uLightning: Model.paramValue(root.params, root.paramPreset || "stormy", "lightning", 1)
  readonly property real uAzimuth: Model.paramValue(root.params, root.paramPreset || "sunny", "azimuth", 1)
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
  property int weatherRetries: 0
  property real nightFactor: 0
  readonly property int weatherResponseMaxBytes: 262144

  function weatherFetchCommand(url, timeoutSec) {
    return ["bash", "-c",
      "set -euo pipefail; "
      + "curl -fsS --max-time \"$1\" --max-filesize \"$2\" -- \"$3\" | head -c \"$2\"",
      "ogarza.weather-fetch", String(timeoutSec), String(root.weatherResponseMaxBytes), url]
  }

  function consumeWeatherStdout(raw, parseFn) {
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
    root.applyWeatherPreset(parseFn(raw))
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
    if (!entry) return
    root.active = entry.active === true
    root.mode = Model.normalizedMode(entry.mode)
    root.exclusivePreset = Model.normalizedExclusivePreset(entry.exclusivePreset)
    root.params = Model.mergeParams(entry.params)
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
    var current = Model.paramValue(root.params, mode, key, key === "strength" ? 1 : 1)
    if (current === clamped) {
      if (persist !== false) persistSettings()
      return
    }
    var next = Model.mergeParams(root.params)
    next[mode][key] = clamped
    root.params = next
    if (persist !== false) persistSettings()
  }

  function nudgeParam(preset, key, dir) {
    var step = key === "strength" ? 0.05 : 0.1
    var current = Model.paramValue(root.params, Model.normalizedMode(preset), key, 1)
    setParam(preset, key, current + dir * step, true)
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
    if (openMeteoProc.running || wttrProc.running) return

    var lat = parseFloat(String(root.configuredLocationState.latitude))
    var lon = parseFloat(String(root.configuredLocationState.longitude))
    if (!isNaN(lat) && !isNaN(lon)) {
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

    var query = Model.wttrLocationQuery(root.configuredLocationState.name, root.configuredLocationState.latitude, root.configuredLocationState.longitude)
    wttrProc.command = root.weatherFetchCommand("https://wttr.in/" + query + "?format=j1", 10)
    wttrProc.running = true
  }

  function applyWeatherPreset(preset) {
    var next = String(preset || "")
    if (next === "") {
      root.scheduleWeatherRetry()
      return
    }
    root.weatherRetries = 0
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
  Component.onCompleted: scanShaders()

  FileView {
    path: Quickshell.env("HOME") + "/.local/state/omarchy/settings/weather.json"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      root.configuredLocationState = Model.parseLocationFile(text())
      root.weatherRetries = 0
      if (root.liveWeatherMode) root.refreshWeather()
    }
    onLoadFailed: {
      root.configuredLocationState = Model.parseLocationFile("")
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
      onStreamFinished: root.consumeWeatherStdout(text, Model.presetFromOpenMeteoJson)
    }
  }

  Process {
    id: wttrProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.consumeWeatherStdout(text, Model.presetFromWttrJson)
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

      ShaderEffect {
        anchors.fill: parent
        blending: true
        fragmentShader: root.shaderUrl
        property real time: clock.elapsedTime
        property vector2d resolution: Qt.vector2d(width, height)
        property real pixelRatio: {
          var scr = panel.screen
          var dpr = scr && scr.devicePixelRatio ? Number(scr.devicePixelRatio) : 1.0
          return Math.max(1.0, dpr)
        }
        property real strength: root.uStrength
        property real density: root.uDensity
        property real speed: root.uSpeed
        property real scale: root.uScale
        property real glow: root.uGlow
        property real lightning: root.uLightning
        property real azimuth: root.uAzimuth
        property real sunDistance: root.uDistance
        property real night: root.effectivePreset === "sunny" ? root.nightFactor : 0
      }
    }
  }
}
