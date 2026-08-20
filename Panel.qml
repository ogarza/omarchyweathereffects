import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "ogarza.weather"
  ipcTarget: "ogarza.weather"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  readonly property var fx: bar && bar.shell && typeof bar.shell.serviceFor === "function"
    ? bar.shell.serviceFor("ogarza.weather") : null

  readonly property var modeList: Model.modes
  readonly property bool showTweaks: !!(fx && Model.hasTweaks(fx.mode))
  readonly property var advancedFields: fx ? Model.fieldsForMode(fx.mode) : []
  readonly property int tweakRowCount: showTweaks ? (1 + advancedFields.length) : 0

  property string focusSection: "modes"
  property int modeIndex: 0
  property int tweakIndex: 0
  property bool cursorActive: false

  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property color dim: Qt.darker(foreground, 1.55)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property bool headerHasCursor: cursorActive && focusSection === "header"
  readonly property color iconColor: fx && fx.active ? foreground : dim
  readonly property string toggleHint: fx && fx.active ? "Turn overlay off" : "Turn overlay on"
  readonly property string heroMeta: fx ? fx.statusText : "Post processing"

  function open() {
    if (root.fx && typeof root.fx.scanShaders === "function") root.fx.scanShaders()
    root.syncCursorToMode()
    root.controller.show()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  function setHeaderCursor() {
    root.cursorActive = true
    root.focusSection = "header"
  }

  function syncCursorToMode() {
    if (!root.fx) return
    for (var i = 0; i < root.modeList.length; i++) {
      if (root.modeList[i].value === root.fx.mode) {
        root.modeIndex = i
        break
      }
    }
  }

  function clampCursor() {
    if (root.focusSection === "tweaks" && !root.showTweaks)
      root.focusSection = "modes"
    if (root.modeIndex < 0) root.modeIndex = 0
    if (root.modeIndex >= root.modeList.length)
      root.modeIndex = Math.max(0, root.modeList.length - 1)
    if (root.tweakIndex < 0) root.tweakIndex = 0
    if (root.tweakIndex >= root.tweakRowCount)
      root.tweakIndex = Math.max(0, root.tweakRowCount - 1)
  }

  function adjustTweak(dir) {
    if (!root.fx || !root.showTweaks) return
    if (root.tweakIndex === 0) {
      root.fx.nudgeParam(root.fx.mode, "strength", dir)
      return
    }
    var field = root.advancedFields[root.tweakIndex - 1]
    if (field) root.fx.nudgeParam(root.fx.mode, field.key, dir)
  }

  function moveCursor(dx, dy) {
    root.cursorActive = true
    root.clampCursor()
    if (root.focusSection === "tweaks" && dx !== 0) {
      root.adjustTweak(dx)
      return
    }
    if (dy === 0) return

    if (root.focusSection === "header") {
      if (dy > 0) root.focusSection = "modes"
      return
    }

    if (root.focusSection === "modes") {
      if (dy < 0) {
        if (root.modeIndex <= 0) {
          root.focusSection = "header"
          return
        }
        root.modeIndex = root.modeIndex - 1
        return
      }
      if (root.modeIndex < root.modeList.length - 1) {
        root.modeIndex = root.modeIndex + 1
        return
      }
      if (root.showTweaks) {
        root.focusSection = "tweaks"
        root.tweakIndex = 0
      }
      return
    }

    if (root.focusSection === "tweaks") {
      if (dy < 0) {
        if (root.tweakIndex <= 0) {
          root.focusSection = "modes"
          root.modeIndex = root.modeList.length - 1
          return
        }
        root.tweakIndex = root.tweakIndex - 1
        return
      }
      if (root.tweakIndex < root.tweakRowCount - 1)
        root.tweakIndex = root.tweakIndex + 1
    }
  }

  function activateCursor() {
    if (!root.fx) return
    if (root.focusSection === "header") {
      root.fx.toggle()
      return
    }
    if (root.focusSection === "modes") {
      var entry = root.modeList[root.modeIndex]
      if (entry) root.fx.setMode(entry.value)
    }
  }

  onShowTweaksChanged: root.clampCursor()

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(320))
    contentHeight: panel.fittedContentHeight(column.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onMoveRequested: function(dx, dy) {
        if (!root.cursorActive) { root.cursorActive = true; return }
        root.moveCursor(dx, dy)
      }
      onActivateRequested: if (root.cursorActive) root.activateCursor()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Flickable {
        id: panelFlick
        anchors.fill: parent
        contentWidth: width
        contentHeight: column.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickableDirection: Flickable.VerticalFlick
        interactive: contentHeight > height

        Column {
          id: column
          width: panelFlick.width
          spacing: Style.space(12)

          Item {
            id: header
            width: parent.width
            implicitHeight: hero.implicitHeight
            readonly property bool ringVisible: root.headerHasCursor
            function focusHero() { root.setHeaderCursor() }

            PanelHero {
              id: hero
              width: parent.width
              title: "ogarza.weather"
              meta: root.heroMeta
              foreground: root.foreground
              fontFamily: root.fontFamily
              iconOpacity: root.fx && root.fx.active ? 1.0 : 0.5
              iconComponent: Component {
                Text {
                  text: root.fx ? root.fx.icon : "󰖗"
                  color: root.iconColor
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.display
                }
              }
              trailingControl: Component {
                ToggleSwitch {
                  id: powerSwitch
                  checked: root.fx ? root.fx.active === true : false
                  hasCursor: header.ringVisible
                  foreground: hero.foreground
                  onHovered: function(on) { if (on) header.focusHero() }
                  onToggled: if (root.fx) root.fx.toggle()

                  PanelToolTip {
                    visible: powerSwitch.containsMouse
                    text: root.toggleHint
                    fontFamily: hero.fontFamily
                  }
                }
              }
            }
          }

          Column {
            width: parent.width
            spacing: Style.space(6)

            Repeater {
              model: root.modeList

              ModeRow {
                required property var modelData
                required property int index
                width: parent.width
                entry: modelData
                rowIndex: index
              }
            }
          }

          Column {
            visible: root.showTweaks
            width: parent.width
            spacing: Style.space(8)

            PanelSeparator {
              foreground: root.foreground
            }

            TweakSlider {
              width: parent.width
              label: "Strength"
              paramKey: "strength"
              maximum: 1
              rowIndex: 0
            }

            Repeater {
              model: root.advancedFields

              TweakSlider {
                required property var modelData
                required property int index
                width: parent.width
                label: String(modelData.label)
                paramKey: String(modelData.key)
                maximum: 2
                rowIndex: index + 1
              }
            }
          }
        }
      }
    }
  }

  component ModeRow: CursorSurface {
    id: modeRow
    property var entry: null
    property int rowIndex: 0
    readonly property string value: entry ? String(entry.value) : ""
    readonly property string label: entry ? String(entry.label) : ""
    readonly property string glyph: entry ? String(entry.icon) : ""
    readonly property bool selected: root.fx && root.fx.mode === modeRow.value

    hasCursor: root.cursorActive && root.focusSection === "modes" && root.modeIndex === rowIndex
    current: selected
    foreground: root.foreground

    implicitHeight: modeContent.implicitHeight + Style.space(10)

    MouseArea {
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onEntered: {
        root.cursorActive = true
        root.focusSection = "modes"
        root.modeIndex = modeRow.rowIndex
      }
      onClicked: if (root.fx) root.fx.setMode(modeRow.value)
    }

    RowLayout {
      id: modeContent
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      anchors.leftMargin: Style.space(10)
      anchors.rightMargin: Style.space(10)
      spacing: Style.space(10)

      Text {
        text: modeRow.glyph
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.icon
        Layout.alignment: Qt.AlignVCenter
      }

      Text {
        Layout.fillWidth: true
        text: modeRow.label
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        font.bold: modeRow.selected
        elide: Text.ElideRight
      }
    }
  }

  component TweakSlider: Column {
    id: tweakCol
    property string label: ""
    property string paramKey: ""
    property real maximum: 1
    property int rowIndex: 0
    spacing: Style.space(4)

    readonly property real paramValue: root.fx
      ? Model.paramValue(root.fx.params, root.fx.mode, tweakCol.paramKey, 1)
      : 1

    Text {
      width: parent.width
      text: tweakCol.label + "  " + Math.round(tweakCol.paramValue * 100) + "%"
      color: root.dim
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
    }

    CursorSurface {
      width: parent.width
      height: slider.implicitHeight + Style.spacing.controlGap
      hasCursor: root.cursorActive && root.focusSection === "tweaks" && root.tweakIndex === tweakCol.rowIndex
      foreground: root.foreground
      outline: true

      PanelSlider {
        id: slider
        bar: root.bar
        anchors.fill: parent
        anchors.leftMargin: Style.space(6)
        anchors.rightMargin: Style.space(6)
        minimum: 0
        maximum: tweakCol.maximum
        step: tweakCol.maximum > 1 ? 0.1 : 0.05
        value: tweakCol.paramValue
        onMoved: function(v) {
          if (root.fx) root.fx.setParam(root.fx.mode, tweakCol.paramKey, v, false)
        }
        onReleased: function(v) {
          if (root.fx) root.fx.setParam(root.fx.mode, tweakCol.paramKey, v, true)
        }
      }

      HoverHandler {
        onHoveredChanged: if (hovered) {
          root.cursorActive = true
          root.focusSection = "tweaks"
          root.tweakIndex = tweakCol.rowIndex
        }
      }
    }
  }
}
