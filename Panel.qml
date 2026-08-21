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
  readonly property var exclusiveList: Model.exclusivePresets
  readonly property bool exclusiveMode: !!(fx && fx.mode === "exclusive")
  readonly property string tweakPreset: {
    if (!fx) return "rain"
    if (fx.mode === "exclusive") return fx.exclusivePreset
    return fx.mode
  }
  readonly property bool showTweaks: !!(fx && Model.hasTweaks(tweakPreset))
  readonly property var advancedFields: fx ? Model.fieldsForMode(tweakPreset) : []
  readonly property int tweakRowCount: showTweaks ? (1 + advancedFields.length) : 0

  property string focusSection: "modes"
  property int modeIndex: 0
  property int trackIndex: 0
  property int tweakIndex: 0
  property bool cursorActive: false

  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property color dim: Qt.darker(foreground, 1.55)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property bool headerHasCursor: cursorActive && focusSection === "header"
  readonly property color iconColor: fx && fx.active ? foreground : dim
  readonly property string toggleHint: fx && fx.active ? "Turn overlay off" : "Turn overlay on"
  readonly property string heroMeta: fx ? fx.statusText : "Post processing"

  function syncPanelOpen() {
    if (root.fx) root.fx.panelOpen = root.opened === true
  }

  function open() {
    if (root.fx && typeof root.fx.scanShaders === "function") root.fx.scanShaders()
    root.syncCursorToMode()
    root.controller.show()
  }

  onOpenedChanged: root.syncPanelOpen()
  onFxChanged: root.syncPanelOpen()

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
    for (var j = 0; j < root.exclusiveList.length; j++) {
      if (root.exclusiveList[j].value === root.fx.exclusivePreset) {
        root.trackIndex = j
        break
      }
    }
  }

  function clampCursor() {
    if (root.focusSection === "track" && !root.exclusiveMode)
      root.focusSection = "modes"
    if (root.focusSection === "tweaks" && !root.showTweaks)
      root.focusSection = root.exclusiveMode ? "track" : "modes"
    if (root.modeIndex < 0) root.modeIndex = 0
    if (root.modeIndex >= root.modeList.length)
      root.modeIndex = Math.max(0, root.modeList.length - 1)
    if (root.trackIndex < 0) root.trackIndex = 0
    if (root.trackIndex >= root.exclusiveList.length)
      root.trackIndex = Math.max(0, root.exclusiveList.length - 1)
    if (root.tweakIndex < 0) root.tweakIndex = 0
    if (root.tweakIndex >= root.tweakRowCount)
      root.tweakIndex = Math.max(0, root.tweakRowCount - 1)
  }

  function adjustTweak(dir) {
    if (!root.fx || !root.showTweaks) return
    if (root.tweakIndex === 0) {
      root.fx.nudgeParam(root.tweakPreset, "strength", dir)
      return
    }
    var field = root.advancedFields[root.tweakIndex - 1]
    if (field) root.fx.nudgeParam(root.tweakPreset, field.key, dir)
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
      if (root.exclusiveMode) {
        root.focusSection = "track"
        root.trackIndex = 0
        return
      }
      if (root.showTweaks) {
        root.focusSection = "tweaks"
        root.tweakIndex = 0
        return
      }
      root.focusSection = "reset"
      return
    }

    if (root.focusSection === "track") {
      if (dy < 0) {
        if (root.trackIndex <= 0) {
          root.focusSection = "modes"
          root.modeIndex = root.modeList.length - 1
          return
        }
        root.trackIndex = root.trackIndex - 1
        return
      }
      if (root.trackIndex < root.exclusiveList.length - 1) {
        root.trackIndex = root.trackIndex + 1
        return
      }
      if (root.showTweaks) {
        root.focusSection = "tweaks"
        root.tweakIndex = 0
        return
      }
      root.focusSection = "reset"
      return
    }

    if (root.focusSection === "tweaks") {
      if (dy < 0) {
        if (root.tweakIndex <= 0) {
          if (root.exclusiveMode) {
            root.focusSection = "track"
            root.trackIndex = root.exclusiveList.length - 1
            return
          }
          root.focusSection = "modes"
          root.modeIndex = root.modeList.length - 1
          return
        }
        root.tweakIndex = root.tweakIndex - 1
        return
      }
      if (root.tweakIndex < root.tweakRowCount - 1) {
        root.tweakIndex = root.tweakIndex + 1
        return
      }
      root.focusSection = "reset"
      return
    }

    if (root.focusSection === "reset") {
      if (dy < 0) {
        if (root.showTweaks) {
          root.focusSection = "tweaks"
          root.tweakIndex = root.tweakRowCount - 1
          return
        }
        if (root.exclusiveMode) {
          root.focusSection = "track"
          root.trackIndex = root.exclusiveList.length - 1
          return
        }
        root.focusSection = "modes"
        root.modeIndex = root.modeList.length - 1
      }
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
      return
    }
    if (root.focusSection === "track") {
      var track = root.exclusiveList[root.trackIndex]
      if (track) root.fx.setExclusivePreset(track.value)
      return
    }
    if (root.focusSection === "reset")
      root.fx.resetParams()
  }

  onShowTweaksChanged: root.clampCursor()
  onExclusiveModeChanged: root.clampCursor()

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
            visible: root.exclusiveMode
            width: parent.width
            spacing: Style.space(6)

            PanelSeparator {
              foreground: root.foreground
            }

            Text {
              width: parent.width
              text: "Track only"
              color: root.dim
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
            }

            Repeater {
              model: root.exclusiveList

              TrackRow {
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
                maximum: Model.fieldMaximum(root.tweakPreset, String(modelData.key))
                rowIndex: index + 1
              }
            }
          }

          Column {
            width: parent.width
            spacing: Style.space(8)

            PanelSeparator {
              foreground: root.foreground
            }

            ResetRow {
              width: parent.width
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

  component TrackRow: CursorSurface {
    id: trackRow
    property var entry: null
    property int rowIndex: 0
    readonly property string value: entry ? String(entry.value) : ""
    readonly property string label: entry ? String(entry.label) : ""
    readonly property string glyph: entry ? String(entry.icon) : ""
    readonly property bool selected: root.fx && root.fx.exclusivePreset === trackRow.value

    hasCursor: root.cursorActive && root.focusSection === "track" && root.trackIndex === rowIndex
    current: selected
    foreground: root.foreground

    implicitHeight: trackContent.implicitHeight + Style.space(10)

    MouseArea {
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onEntered: {
        root.cursorActive = true
        root.focusSection = "track"
        root.trackIndex = trackRow.rowIndex
      }
      onClicked: if (root.fx) root.fx.setExclusivePreset(trackRow.value)
    }

    RowLayout {
      id: trackContent
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      anchors.leftMargin: Style.space(10)
      anchors.rightMargin: Style.space(10)
      spacing: Style.space(10)

      Text {
        text: trackRow.glyph
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.icon
        Layout.alignment: Qt.AlignVCenter
      }

      Text {
        Layout.fillWidth: true
        text: trackRow.label
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        font.bold: trackRow.selected
        elide: Text.ElideRight
      }
    }
  }

  component ResetRow: CursorSurface {
    id: resetRow
    hasCursor: root.cursorActive && root.focusSection === "reset"
    current: false
    foreground: root.foreground

    implicitHeight: resetContent.implicitHeight + Style.space(10)

    MouseArea {
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onEntered: {
        root.cursorActive = true
        root.focusSection = "reset"
      }
      onClicked: if (root.fx) root.fx.resetParams()
    }

    RowLayout {
      id: resetContent
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      anchors.leftMargin: Style.space(10)
      anchors.rightMargin: Style.space(10)
      spacing: Style.space(10)

      Text {
        text: "󰑓"
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.icon
        Layout.alignment: Qt.AlignVCenter
      }

      Text {
        Layout.fillWidth: true
        text: "Reset to defaults"
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
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
      ? Model.paramValue(root.fx.params, root.tweakPreset, tweakCol.paramKey, 1)
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
          if (root.fx) root.fx.setParam(root.tweakPreset, tweakCol.paramKey, v, false)
        }
        onReleased: function(v) {
          if (root.fx) root.fx.setParam(root.tweakPreset, tweakCol.paramKey, v, true)
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
