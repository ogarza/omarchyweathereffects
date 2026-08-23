import QtQuick
import Quickshell.Io
import qs.Ui
import "Model.js" as Model

BarWidget {
  id: root
  moduleName: "ogarza.weather"

  readonly property var fx: bar && bar.shell && typeof bar.shell.serviceFor === "function"
    ? bar.shell.serviceFor("ogarza.weather") : null

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
  }

  function togglePanel() {
    if (panelLoader.item && panelLoader.item.toggle) panelLoader.item.toggle()
  }

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false

  function open() {
    if (panelLoader.item && panelLoader.item.open) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item && panelLoader.item.close) panelLoader.item.close()
  }

  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  IpcHandler {
    target: "ogarza.weather"
    function open() { root.open() }
    function close() { root.close() }
    function show() { root.open() }
    function hide() { root.close() }
    function toggle() { root.togglePanel() }
    function preview(preset: string): string {
      return root.fx && root.fx.previewPreset ? root.fx.previewPreset(preset) : "no-service"
    }
    function overlay(): string {
      return root.fx && root.fx.overlayDebugState ? root.fx.overlayDebugState() : "no-service"
    }
    function quality(level: string): string {
      if (!root.fx || typeof root.fx.setQuality !== "function") return "no-service"
      if (String(level || "")) root.fx.setQuality(level)
      return root.fx.quality
    }
    function hypr(value: string): string {
      if (!root.fx || typeof root.fx.setHyprEnabled !== "function") return "no-service"
      root.fx.setHyprEnabled(root.fx.parseOnOffToggle(value, root.fx.hyprEnabled))
      return root.fx.hyprEnabled ? "on" : "off"
    }
    function power(value: string): string {
      return root.fx && root.fx.ipcPower ? root.fx.ipcPower(value) : "no-service"
    }
    function active(value: string): string {
      return root.power(value)
    }
    function mode(value: string): string {
      return root.fx && root.fx.ipcMode ? root.fx.ipcMode(value) : "no-service"
    }
    function track(value: string): string {
      return root.fx && root.fx.ipcTrack ? root.fx.ipcTrack(value) : "no-service"
    }
    function exclusive(value: string): string {
      return root.track(value)
    }
    function layer(slot: string, shader: string): string {
      return root.fx && root.fx.ipcLayer ? root.fx.ipcLayer(slot, shader) : "no-service"
    }
    function param(preset: string, key: string, value: string): string {
      return root.fx && root.fx.ipcParam ? root.fx.ipcParam(preset, key, value) : "no-service"
    }
    function reset(): string {
      return root.fx && root.fx.ipcReset ? root.fx.ipcReset() : "no-service"
    }
    function refresh(): string {
      return root.fx && root.fx.ipcRefresh ? root.fx.ipcRefresh() : "no-service"
    }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: Model.barIcon
    active: root.fx ? root.fx.active : false
    useActiveColor: true
    tooltipText: root.fx ? root.fx.tooltipText : "Omarchy Weather Effects"

    onPressed: function(b) {
      if (b === Qt.RightButton) {
        if (root.fx) root.fx.toggle()
      } else {
        root.togglePanel()
      }
    }
  }
}
