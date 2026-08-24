// Modes, weather-code → preset mapping (mirrors omarchy.weather /
// omarchy-weather-icon groups), and shader filename helpers.

var modes = [
  { value: "none", label: "None", icon: "󰅖", description: "No overlay. The desktop stays clear until you pick an effect." },
  { value: "rain", label: "Rain", icon: "󰖗", description: "Beads and trails on glass. With Hyprland distortion on and Refract above 0, drops warp the real desktop (painted rain is skipped so it is not drawn twice). Clicks through a warped drop land a little off. Refract 0 is the painted look only." },
  { value: "snow", label: "Snow", icon: "󰖘", description: "Falling flakes with a bit of depth. Overlay only — no desktop warp. Lower Quality draws fewer flake layers." },
  { value: "fog", label: "Cloud/Fog", icon: "󰖑", description: "Soft FBM clouds, denser toward the upper sky, with the very top and bottom faded so the desktop stays readable. Overlay only." },
  { value: "sunny", label: "Sunny", icon: "󰖙", description: "Warm glow, faint shafts, and dust. Over civil twilight (sun 0° to −6°, a few minutes) the color eases to cool moonlight. Optional heat haze warps the desktop when Hyprland distortion is on and outdoor temperature is at or above On above (default 90°F / 32.2°C)." },
  { value: "partly", label: "Partly cloudy", icon: "󰖕", description: "Clouds plus sun. The sun layer uses the same twilight shift to moonlight as Sunny, including the haze temperature gate. In Follow, this condition becomes Moonlit clouds after sunset." },
  { value: "overcast", label: "Overcast", icon: "󰖐", description: "Heavy clouds with a faint sun (same twilight-to-moonlight shift and haze gate as Sunny)." },
  { value: "sunshower", label: "Sun shower", icon: "󰖖", description: "Sun and rain together. Rain refraction follows the Rain rules. Add Rainbow is off by default; that bow fades after sunset unless After sunset is on." },
  { value: "moonlit", label: "Moonlit clouds", icon: "󰖔", description: "Clouds with a cool moon (the sun shader forced to night). Haze still uses Sunny’s On above temperature. Follow uses this for partly cloudy after sunset. Exclusive treats Partly cloudy and Moonlit clouds as a match for each other." },
  { value: "drizzle", label: "Drizzle", icon: "󰖑", description: "Light rain through thin clouds. Rain refraction follows the Rain rules (Hyprland warp skips the painted drops)." },
  { value: "squall", label: "Snow squall", icon: "󰼶", description: "Snow driven through clouds. Overlay only — snow does not warp the desktop." },
  { value: "wintry", label: "Wintry mix", icon: "󰙿", description: "Rain and snow together. The rain layer can still refract the desktop; painted rain is skipped while that warp is live." },
  { value: "stormy", label: "Stormy", icon: "󰖓", description: "Diagonal rain, a dark Gloom wash, lightning bolts, and a brief sky flash. Refraction follows the Rain rules; bolts stay on the overlay (no desktop shake). Angle is how much the rain leans, not bolt direction." },
  { value: "follow", label: "Follow", icon: "󰔏", description: "Matches the live forecast for your Omarchy location (Open-Meteo with coords, else wttr). Waits for location before the first fetch. Clear sky is Sunny; thunder is Stormy; partly cloudy becomes Moonlit clouds after sunset. Never picks Fire, Rainbow, or Custom. Forecast changes fade over about ten seconds." },
  { value: "exclusive", label: "Exclusive", icon: "󰮯", description: "Same forecast as Follow, but the overlay runs only when live weather matches Track only. This panel previews the tracked look until you close it. Partly cloudy and Moonlit clouds count as a match for each other. Fire, Rainbow, and Custom cannot be tracked." },
  { value: "fire", label: "Fire", icon: "󰈸", description: "Flames along the bottom of the screen. Optional heat haze always uses the Fire Haze slider (not gated by outdoor temperature). Manual only — Follow never picks this." },
  { value: "rainbow", label: "Rainbow", icon: "󰟗", description: "Primary and secondary bows opposite the sun. Invisible after sunset unless After sunset is on; then Night glow cools the bands and Night strength sets how visible they stay. Manual only — Follow never picks this. Add Rainbow on other modes shares these sliders." },
  { value: "custom", label: "Custom", icon: "󰣖", description: "Stack up to three shaders. None turns a layer off. Sliders are shared with the standalone modes (changing rain density here also changes Rain). Manual only — Follow never picks this." }
]

// Bar glyph: sparkles = desktop effects, not a forecast (those stay in the panel).
var barIcon = "󰙲"

// Overlay render scale. Extreme is native pixels with no offscreen blit.
var qualityLevels = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "extreme", label: "Extreme" }
]

var qualityValues = {
  low: true,
  medium: true,
  high: true,
  extreme: true
}

function normalizedQuality(value) {
  var v = String(value || "").toLowerCase()
  return qualityValues[v] ? v : "high"
}

function qualityRank(value) {
  var v = normalizedQuality(value)
  if (v === "low") return 0
  if (v === "medium") return 1
  if (v === "high") return 2
  return 3
}

function qualityScale(value) {
  var v = normalizedQuality(value)
  if (v === "low") return 0.33
  if (v === "medium") return 0.5
  if (v === "high") return 0.75
  return 1
}

function indexOfQuality(value) {
  var v = normalizedQuality(value)
  for (var i = 0; i < qualityLevels.length; i++) {
    if (qualityLevels[i].value === v) return i
  }
  return 2
}

function qualityTextureSize(width, height, devicePixelRatio, value) {
  var s = qualityScale(value)
  var dpr = Math.max(1, Number(devicePixelRatio) || 1)
  return {
    w: Math.max(1, Math.round(Number(width) * dpr * s)),
    h: Math.max(1, Math.round(Number(height) * dpr * s))
  }
}

var modeValues = {
  none: true,
  rain: true,
  snow: true,
  fog: true,
  sunny: true,
  partly: true,
  overcast: true,
  sunshower: true,
  moonlit: true,
  drizzle: true,
  squall: true,
  wintry: true,
  stormy: true,
  fire: true,
  rainbow: true,
  custom: true,
  follow: true,
  exclusive: true
}

// Follow / Exclusive never pick fire or rainbow — same Open-Meteo / wttr groups.
var exclusivePresets = [
  { value: "rain", label: "Rain", icon: "󰖗" },
  { value: "snow", label: "Snow", icon: "󰖘" },
  { value: "fog", label: "Cloud/Fog", icon: "󰖑" },
  { value: "sunny", label: "Sunny", icon: "󰖙" },
  { value: "partly", label: "Partly cloudy", icon: "󰖕" },
  { value: "overcast", label: "Overcast", icon: "󰖐" },
  { value: "sunshower", label: "Sun shower", icon: "󰖖" },
  { value: "moonlit", label: "Moonlit clouds", icon: "󰖔" },
  { value: "drizzle", label: "Drizzle", icon: "󰖑" },
  { value: "squall", label: "Snow squall", icon: "󰼶" },
  { value: "wintry", label: "Wintry mix", icon: "󰙿" },
  { value: "stormy", label: "Stormy", icon: "󰖓" }
]

var exclusivePresetValues = {
  rain: true,
  snow: true,
  fog: true,
  sunny: true,
  partly: true,
  overcast: true,
  sunshower: true,
  moonlit: true,
  drizzle: true,
  squall: true,
  wintry: true,
  stormy: true
}

// Two-shader recipes plus an optional rainbow layer. Follow never uses fire or rainbow as the mapped condition.
var optionalRainbowLayer = {
  shader: "rainbow",
  strengthKey: "strengthC",
  defaultStrength: 0.65,
  label: "Rainbow",
  optional: true,
  enableKey: "enableC",
  defaultOn: false
}

var mixRecipes = {
  partly: {
    layers: [
      { shader: "fog", strengthKey: "strengthA", defaultStrength: 0.5, label: "Clouds" },
      { shader: "sunny", strengthKey: "strengthB", defaultStrength: 0.85, label: "Sun" },
      optionalRainbowLayer
    ]
  },
  overcast: {
    layers: [
      { shader: "fog", strengthKey: "strengthA", defaultStrength: 1, label: "Clouds" },
      { shader: "sunny", strengthKey: "strengthB", defaultStrength: 0.18, label: "Sun" },
      optionalRainbowLayer
    ]
  },
  sunshower: {
    layers: [
      { shader: "sunny", strengthKey: "strengthA", defaultStrength: 0.6, label: "Sun" },
      { shader: "rain", strengthKey: "strengthB", defaultStrength: 0.7, label: "Rain" },
      optionalRainbowLayer
    ]
  },
  moonlit: {
    layers: [
      { shader: "fog", strengthKey: "strengthA", defaultStrength: 0.35, label: "Clouds" },
      { shader: "sunny", strengthKey: "strengthB", defaultStrength: 0.9, label: "Moon" },
      optionalRainbowLayer
    ]
  },
  drizzle: {
    layers: [
      { shader: "fog", strengthKey: "strengthA", defaultStrength: 0.55, label: "Haze" },
      { shader: "rain", strengthKey: "strengthB", defaultStrength: 0.5, label: "Rain" },
      optionalRainbowLayer
    ]
  },
  squall: {
    layers: [
      { shader: "fog", strengthKey: "strengthA", defaultStrength: 0.8, label: "Haze" },
      { shader: "snow", strengthKey: "strengthB", defaultStrength: 0.4, label: "Snow" },
      optionalRainbowLayer
    ]
  },
  wintry: {
    layers: [
      { shader: "rain", strengthKey: "strengthA", defaultStrength: 1, label: "Rain" },
      { shader: "snow", strengthKey: "strengthB", defaultStrength: 0.5, label: "Snow" },
      optionalRainbowLayer
    ]
  },
  custom: {
    layers: [
      { shader: "rain", strengthKey: "strengthA", defaultStrength: 0.7, label: "Layer A" },
      { shader: "fog", strengthKey: "strengthB", defaultStrength: 0.7, label: "Layer B" },
      { shader: "none", strengthKey: "strengthC", defaultStrength: 0.7, label: "Layer C" }
    ]
  }
}

function isManualOnlyMode(value) {
  var v = String(value || "")
  return v === "fire" || v === "rainbow" || v === "custom"
}

function effectPresetEntries() {
  var out = []
  for (var i = 0; i < modes.length; i++) {
    if (isEffectPreset(modes[i].value))
      out.push({ value: modes[i].value, label: modes[i].label, icon: modes[i].icon })
  }
  return out
}

function customLayerEntries() {
  return [{ value: "none", label: "None", icon: "󰅖" }].concat(effectPresetEntries())
}

function normalizedEffectPreset(value, fallback) {
  var v = normalizedMode(value)
  if (isEffectPreset(v)) return v
  return fallback || "rain"
}

function normalizedCustomLayer(value, fallback) {
  var v = String(value || "")
  if (v === "none") return "none"
  if (v === "") return fallback || "none"
  return normalizedEffectPreset(v, fallback || "none")
}

function modesForPanel(manualOnly) {
  var want = !!manualOnly
  var out = []
  for (var i = 0; i < modes.length; i++) {
    if (isManualOnlyMode(modes[i].value) === want) out.push(modes[i])
  }
  return out
}

function indexOfMode(value) {
  var v = String(value || "")
  for (var i = 0; i < modes.length; i++) {
    if (modes[i].value === v) return i
  }
  return 0
}

function modeEntry(value) {
  var v = String(value || "")
  for (var i = 0; i < modes.length; i++) {
    if (modes[i].value === v) return modes[i]
  }
  return modes[0]
}

function isEffectPreset(value) {
  var v = String(value || "")
  return v === "rain" || v === "snow" || v === "fog" || v === "sunny" || v === "stormy" || v === "fire" || v === "rainbow"
}

function isMixPreset(value) {
  return !!mixRecipes[String(value || "")]
}

function isVisualPreset(value) {
  return isEffectPreset(value) || isMixPreset(value)
}

function extraRainbowLayer(visual) {
  var v = String(visual || "")
  if (v === "rainbow" || v === "custom" || v === "none") return null
  if (!isEffectPreset(v)) return null
  return optionalRainbowLayer
}

function layerActive(params, visual, layer) {
  if (!layer) return false
  if (layer.shader === "none") return false
  if (!layer.optional) return true
  return paramValue(params, visual, layer.enableKey || "enableC", layer.defaultOn ? 1 : 0) >= 0.5
}

function mixRecipe(value, shaderA, shaderB, shaderC) {
  var id = String(value || "")
  if (id === "custom") {
    var base = mixRecipes.custom
    return {
      layers: [
        {
          shader: normalizedCustomLayer(shaderA, "rain"),
          strengthKey: "strengthA",
          defaultStrength: base.layers[0].defaultStrength,
          label: base.layers[0].label
        },
        {
          shader: normalizedCustomLayer(shaderB, "fog"),
          strengthKey: "strengthB",
          defaultStrength: base.layers[1].defaultStrength,
          label: base.layers[1].label
        },
        {
          shader: normalizedCustomLayer(shaderC, "none"),
          strengthKey: "strengthC",
          defaultStrength: base.layers[2].defaultStrength,
          label: base.layers[2].label
        }
      ]
    }
  }
  return mixRecipes[id] || null
}

function shaderForVisualSlot(visual, slot, shaderA, shaderB, shaderC, params) {
  var recipe = mixRecipe(visual, shaderA, shaderB, shaderC)
  if (recipe && recipe.layers[slot]) {
    var layer = recipe.layers[slot]
    if (!layerActive(params, visual, layer)) return ""
    return layer.shader
  }
  if (slot === 0 && isEffectPreset(visual)) return String(visual)
  if (slot === 2 && extraRainbowLayer(visual) && layerActive(params, visual, extraRainbowLayer(visual)))
    return "rainbow"
  return ""
}

function slotStrength(params, visual, slot, shaderA, shaderB, shaderC) {
  var recipe = mixRecipe(visual, shaderA, shaderB, shaderC)
  if (recipe && recipe.layers[slot]) {
    var layer = recipe.layers[slot]
    if (!layerActive(params, visual, layer)) return 0
    return paramValue(params, visual, layer.strengthKey, layer.defaultStrength)
  }
  if (slot === 0 && isEffectPreset(visual))
    return paramValue(params, visual, "strength", 1)
  if (slot === 2 && extraRainbowLayer(visual) && layerActive(params, visual, extraRainbowLayer(visual)))
    return paramValue(params, visual, "strengthC", optionalRainbowLayer.defaultStrength)
  return 0
}

function layerStrengthForShader(visual, shader, params, shaderA, shaderB, shaderC) {
  var want = String(shader || "")
  if (!want) return 0
  var best = 0
  for (var slot = 0; slot < 3; slot++) {
    if (shaderForVisualSlot(visual, slot, shaderA, shaderB, shaderC, params) === want)
      best = Math.max(best, slotStrength(params, visual, slot, shaderA, shaderB, shaderC))
  }
  return best
}

function rainLayerStrength(visual, params, shaderA, shaderB, shaderC) {
  return layerStrengthForShader(visual, "rain", params, shaderA, shaderB, shaderC)
}

function stormLayerStrength(visual, params, shaderA, shaderB, shaderC) {
  return layerStrengthForShader(visual, "stormy", params, shaderA, shaderB, shaderC)
}

function rainRefractSource(visual, params, shaderA, shaderB, shaderC) {
  var rainS = rainLayerStrength(visual, params, shaderA, shaderB, shaderC)
  var stormS = stormLayerStrength(visual, params, shaderA, shaderB, shaderC)
  var rainOn = rainS > 0.001 && paramValue(params, "rain", "refract", 1) > 0.001
  var stormOn = stormS > 0.001 && paramValue(params, "stormy", "refract", 1) > 0.001
  if (rainOn && stormOn) return rainS >= stormS ? "rain" : "stormy"
  if (rainOn) return "rain"
  if (stormOn) return "stormy"
  return ""
}

// 90°F in Celsius. Stored unit is always °C; the panel shows °F when locale is imperial.
var defaultHazeTempC = (90 - 32) * 5 / 9

function celsiusToFahrenheit(c) {
  return Number(c) * 9 / 5 + 32
}

function fahrenheitToCelsius(f) {
  return (Number(f) - 32) * 5 / 9
}

function localeUsesImperial(localeName) {
  var name = String(localeName || "").replace(".", "_")
  return /^en[_-]US($|[_.-])/.test(name) || /^en[_-]LR($|[_.-])/.test(name) || /^my($|[_.-])/.test(name)
}

function shouldUseImperial(localeName) {
  return localeUsesImperial(localeName)
}

function hazeOutdoorGate(outdoorTempC, thresholdC) {
  var outdoor = parseFloat(outdoorTempC)
  var need = parseFloat(thresholdC)
  if (isNaN(outdoor) || isNaN(need)) return 0
  if (outdoor >= need) return 1
  return Math.max(0, Math.min(1, (outdoor - (need - 2)) / 2))
}

function hazeLayerAmounts(visual, params, shaderA, shaderB, shaderC, outdoorTempC) {
  var sunnyS = layerStrengthForShader(visual, "sunny", params, shaderA, shaderB, shaderC)
    * paramValue(params, "sunny", "haze", 0)
    * hazeOutdoorGate(outdoorTempC, paramValue(params, "sunny", "temperature", defaultHazeTempC))
  var fireS = layerStrengthForShader(visual, "fire", params, shaderA, shaderB, shaderC)
    * paramValue(params, "fire", "haze", 0)
  var fireHaze = fireS > 0 && fireS >= sunnyS
  return {
    sunny: sunnyS,
    fire: fireS,
    amount: Math.max(sunnyS, fireS),
    fireHaze: fireHaze
  }
}

function screenShaderKind(visual, params, shaderA, shaderB, shaderC, outdoorTempC) {
  var parts = []
  var rainOn = rainRefractSource(visual, params, shaderA, shaderB, shaderC) !== ""
  var hazeOn = hazeLayerAmounts(visual, params, shaderA, shaderB, shaderC, outdoorTempC).amount > 0.001
  if (rainOn) parts.push("rain")
  if (hazeOn) parts.push("haze")
  return parts.join("+")
}

function visualNeedsScreenShader(visual, params, shaderA, shaderB, shaderC, outdoorTempC) {
  return screenShaderKind(visual, params, shaderA, shaderB, shaderC, outdoorTempC) !== ""
}

function hyprShaderInput(visual, params, quality, shaderA, shaderB, shaderC, pixelRatio, outdoorTempC) {
  var kind = screenShaderKind(visual, params, shaderA, shaderB, shaderC, outdoorTempC)
  var haze = hazeLayerAmounts(visual, params, shaderA, shaderB, shaderC, outdoorTempC)
  var rainSrc = rainRefractSource(visual, params, shaderA, shaderB, shaderC)
  var stormRain = rainSrc === "stormy"
  var rainPreset = stormRain ? "stormy" : "rain"
  return {
    kind: kind,
    density: paramValue(params, rainPreset, "density", stormRain ? 1 : 0.8),
    speed: paramValue(params, rainPreset, "speed", stormRain ? 1.15 : 1),
    scale: paramValue(params, rainPreset, "scale", 1),
    glow: stormRain ? paramValue(params, "stormy", "sheen", 0.6) : paramValue(params, "rain", "glow", 0.6),
    strength: stormRain
      ? stormLayerStrength(visual, params, shaderA, shaderB, shaderC)
      : rainLayerStrength(visual, params, shaderA, shaderB, shaderC),
    refract: paramValue(params, rainPreset, "refract", 1),
    quality: qualityRank(quality),
    haze: haze.amount,
    fireHaze: haze.fireHaze,
    pixelRatio: pixelRatio,
    stormRain: stormRain,
    azimuth: paramValue(params, "stormy", "azimuth", 1)
  }
}

function sunnyHazeWanted(params) {
  return paramValue(params, "sunny", "haze", 0) > 0.001
}

function normalizedMode(value) {
  var v = String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
  if (v === "cloud" || v === "cloud/fog" || v === "cloud-fog" || v === "clouds") return "fog"
  if (v === "off" || v === "clear" || v === "no" || v === "disabled") return "none"
  if (v === "partly-cloudy" || v === "partlycloudy" || v === "partly cloudy") return "partly"
  if (v === "sun-shower" || v === "sun shower") return "sunshower"
  if (v === "moonlit-clouds" || v === "moonlit clouds") return "moonlit"
  if (v === "foggy-rain" || v === "foggy rain") return "drizzle"
  if (v === "snow-squall" || v === "snow squall") return "squall"
  if (v === "wintry-mix" || v === "wintry mix") return "wintry"
  if (v === "thundershower") return "stormy"
  if (modeValues[v]) return v
  return "none"
}

function followDayNightPreset(preset, nightFactor) {
  var p = String(preset || "")
  if (p === "partly" && moonlightActive(nightFactor)) return "moonlit"
  if (p === "moonlit" && !moonlightActive(nightFactor)) return "partly"
  return p
}

function isLiveWeatherMode(value) {
  var m = normalizedMode(value)
  return m === "follow" || m === "exclusive"
}

function exclusivePresetEntry(value) {
  var v = String(value || "")
  for (var i = 0; i < exclusivePresets.length; i++) {
    if (exclusivePresets[i].value === v) return exclusivePresets[i]
  }
  return exclusivePresets[1]
}

function normalizedExclusivePreset(value) {
  var v = normalizedMode(value)
  if (exclusivePresetValues[v]) return v
  return "snow"
}

function labelForExclusivePreset(value, nightFactor) {
  return labelForPreset(normalizedExclusivePreset(value), nightFactor)
}

function labelForMode(value) {
  return modeEntry(normalizedMode(value)).label
}

function iconForMode(value) {
  return modeEntry(value).icon
}

function descriptionForPreset(preset, nightFactor) {
  var v = String(preset || "")
  if (v === "sunny" && moonlightActive(nightFactor))
    return "Cool moonlight wash, shafts, and faint dust. Color eases over civil twilight (sun 0° to −6°, a few minutes). Heat haze still waits for outdoor temperature at or above On above."
  if (v === "partly" && moonlightActive(nightFactor))
    return "Broken clouds with moonlight instead of sun (same twilight blend as Sunny). Follow would map this to Moonlit clouds. Haze still uses Sunny’s On above temperature."
  var entry = modeEntry(v)
  return entry && entry.description ? String(entry.description) : ""
}

function moonlightActive(nightFactor) {
  return parseFloat(nightFactor) >= 0.5
}

function labelForPreset(preset, nightFactor) {
  var v = String(preset || "")
  if (v === "none") return "None"
  if (v === "fog") return "Cloud/Fog"
  if (v === "rain") return "Rain"
  if (v === "snow") return "Snow"
  if (v === "sunny") return moonlightActive(nightFactor) ? "Moonlight" : "Sunny"
  if (v === "partly") return "Partly cloudy"
  if (v === "overcast") return "Overcast"
  if (v === "sunshower") return "Sun shower"
  if (v === "moonlit") return "Moonlit clouds"
  if (v === "drizzle") return "Drizzle"
  if (v === "squall") return "Snow squall"
  if (v === "wintry") return "Wintry mix"
  if (v === "stormy") return "Stormy"
  if (v === "fire") return "Fire"
  if (v === "rainbow") return "Rainbow"
  if (v === "custom") return "Custom"
  return labelForMode(v)
}

function iconForPreset(preset, nightFactor) {
  var v = String(preset || "")
  if (v === "sunny" && moonlightActive(nightFactor)) return "󰖔"
  if (v === "partly" && moonlightActive(nightFactor)) return "󰖔"
  return iconForMode(v)
}

function shaderFileForPreset(preset) {
  var v = String(preset || "")
  if (!isEffectPreset(v)) return ""
  if (v === "fog") return "fog.frag.qsb"
  if (v === "snow") return "snow.frag.qsb"
  if (v === "sunny") return "sunny.frag.qsb"
  if (v === "stormy") return "stormy.frag.qsb"
  if (v === "fire") return "fire.frag.qsb"
  if (v === "rainbow") return "rainbow.frag.qsb"
  return "rain.frag.qsb"
}

var tweakFields = {
  rain: [
    { key: "density", label: "Density", kind: "slider", max: 2.4 },
    { key: "speed", label: "Speed", kind: "slider", max: 2 },
    { key: "scale", label: "Scale", kind: "slider", max: 1 },
    { key: "glow", label: "Sheen", kind: "slider", max: 2 },
    { key: "refract", label: "Refract", kind: "slider", max: 1 }
  ],
  snow: [
    { key: "density", label: "Density", kind: "slider", max: 2 },
    { key: "speed", label: "Speed", kind: "slider", max: 2 },
    { key: "scale", label: "Scale", kind: "slider", max: 2 },
    { key: "glow", label: "Brightness", kind: "slider", max: 2 }
  ],
  fog: [
    { key: "density", label: "Density", kind: "slider", max: 2 },
    { key: "speed", label: "Speed", kind: "slider", max: 2 },
    { key: "scale", label: "Size", kind: "slider", max: 2 }
  ],
  sunny: [
    { key: "glow", label: "Glow", kind: "slider", max: 2 },
    { key: "speed", label: "Speed", kind: "slider", max: 2 },
    { key: "density", label: "Dust", kind: "slider", max: 2 },
    { key: "azimuth", label: "Position", kind: "slider", max: 2 },
    { key: "distance", label: "Distance", kind: "slider", max: 2 },
    { key: "haze", label: "Haze", kind: "slider", max: 1 },
    { key: "temperature", label: "On above", kind: "slider", format: "temp", min: 10, max: 49 }
  ],
  stormy: [
    { key: "density", label: "Density", kind: "slider", max: 2.4 },
    { key: "speed", label: "Speed", kind: "slider", max: 2 },
    { key: "scale", label: "Scale", kind: "slider", max: 1 },
    { key: "sheen", label: "Sheen", kind: "slider", max: 2 },
    { key: "refract", label: "Refract", kind: "slider", max: 1 },
    { key: "lightning", label: "Flash", kind: "slider", max: 2 },
    { key: "frequency", label: "Frequency", kind: "slider", max: 2 },
    { key: "glow", label: "Gloom", kind: "slider", max: 2 },
    { key: "azimuth", label: "Angle", kind: "slider", max: 2 }
  ],
  fire: [
    { key: "density", label: "Density", kind: "slider", max: 2 },
    { key: "speed", label: "Speed", kind: "slider", max: 2 },
    { key: "scale", label: "Scale", kind: "slider", max: 2 },
    { key: "glow", label: "Glow", kind: "slider", max: 2 },
    { key: "haze", label: "Haze", kind: "slider", max: 1 }
  ],
  rainbow: [
    { key: "glow", label: "Glow", kind: "slider", max: 2 },
    { key: "density", label: "Vividness", kind: "slider", max: 2 },
    { key: "scale", label: "Size", kind: "slider", max: 4 },
    { key: "azimuth", label: "Horizontal", kind: "slider", max: 2 },
    { key: "lightning", label: "Height", kind: "slider", min: -2, max: 2 },
    { key: "distance", label: "Distance", kind: "slider", max: 2 },
    { key: "speed", label: "Shimmer", kind: "slider", max: 2 },
    { key: "nightVisible", label: "After sunset", kind: "check", max: 1 },
    { key: "nightTint", label: "Night glow", kind: "slider", max: 2, requires: "nightVisible" },
    { key: "nightStrength", label: "Night strength", kind: "slider", max: 1, requires: "nightVisible" }
  ]
}

function defaultParams() {
  var out = {
    rain: { strength: 1, density: 0.8, speed: 1, scale: 1, glow: 0.6, refract: 1, enableC: 0, strengthC: 0.65 },
    snow: { strength: 1, density: 0.8, speed: 1, scale: 0.8, glow: 0.3, enableC: 0, strengthC: 0.65 },
    fog: { strength: 1, density: 1, speed: 0.9, scale: 1, enableC: 0, strengthC: 0.65 },
    sunny: { strength: 1, glow: 1, speed: 1, density: 1.2, azimuth: 1.2, distance: 1, haze: 0.5, temperature: defaultHazeTempC, enableC: 0, strengthC: 0.65 },
    stormy: { strength: 1, density: 1, speed: 1.15, scale: 1, sheen: 0.6, refract: 1, lightning: 1.5, frequency: 1, glow: 1, azimuth: 1, enableC: 0, strengthC: 0.65 },
    fire: { strength: 1, density: 1, speed: 0.5, scale: 1, glow: 1, haze: 0.5, enableC: 0, strengthC: 0.65 },
    rainbow: { strength: 1, glow: 1, density: 1, scale: 1, azimuth: 0.8, lightning: 0.65, distance: 1, speed: 1, nightVisible: 0, nightTint: 1, nightStrength: 0.7 }
  }
  for (var id in mixRecipes) {
    var layers = mixRecipes[id].layers
    out[id] = {}
    for (var li = 0; li < layers.length; li++) {
      out[id][layers[li].strengthKey] = layers[li].defaultStrength
      if (layers[li].optional)
        out[id][layers[li].enableKey || "enableC"] = layers[li].defaultOn ? 1 : 0
    }
  }
  return out
}

function cloneField(field, preset, label) {
  return {
    key: field.key,
    label: label || field.label,
    kind: field.kind || "slider",
    format: field.format,
    min: field.min,
    max: field.max,
    requires: field.requires,
    preset: preset
  }
}

function strengthField(preset, label) {
  return { key: "strength", label: label || "Strength", kind: "slider", max: 1, preset: preset }
}

function appendLayerShaderFields(rows, shader, params) {
  var shaderFields = tweakFields[shader] || []
  for (var i = 0; i < shaderFields.length; i++) {
    var field = shaderFields[i]
    if (field.requires && paramValue(params, shader, field.requires, 0) < 0.5)
      continue
    rows.push(cloneField(field, shader, field.label))
  }
}

function fieldsForCustomLayer(slot, shaderA, shaderB, shaderC, params) {
  var recipe = mixRecipe("custom", shaderA, shaderB, shaderC)
  if (!recipe || !recipe.layers[slot]) return []
  var layer = recipe.layers[slot]
  if (!isEffectPreset(layer.shader)) return []
  var rows = [{
    key: layer.strengthKey,
    label: layer.label,
    kind: "slider",
    max: 1,
    preset: "custom"
  }]
  appendLayerShaderFields(rows, layer.shader, params)
  return rows
}

function fieldsForVisualLayer(visual, slot, shaderA, shaderB, shaderC, params) {
  var m = normalizedMode(visual)
  if (m === "custom")
    return fieldsForCustomLayer(slot, shaderA, shaderB, shaderC, params)
  if (!isVisualPreset(m)) return []
  var recipe = mixRecipe(m, shaderA, shaderB, shaderC)
  if (recipe) {
    if (!recipe.layers[slot]) return []
    var layer = recipe.layers[slot]
    if (layer.shader === "none") return []
    var mixRows = []
    if (layer.optional) {
      mixRows.push({
        key: layer.enableKey || "enableC",
        label: "Add " + layer.label,
        kind: "check",
        max: 1,
        preset: m
      })
      if (!layerActive(params, m, layer)) return mixRows
    }
    mixRows.push({
      key: layer.strengthKey,
      label: layer.label,
      kind: "slider",
      max: 1,
      preset: m
    })
    appendLayerShaderFields(mixRows, layer.shader, params)
    return mixRows
  }
  if (slot === 0) {
    if (!isEffectPreset(m)) return []
    var singleRows = [strengthField(m, "Strength")]
    appendLayerShaderFields(singleRows, m, params)
    return singleRows
  }
  if (slot === 2) {
    var extra = extraRainbowLayer(m)
    if (!extra) return []
    var extraRows = [{
      key: extra.enableKey || "enableC",
      label: "Add " + extra.label,
      kind: "check",
      max: 1,
      preset: m
    }]
    if (layerActive(params, m, extra)) {
      extraRows.push({
        key: extra.strengthKey,
        label: extra.label,
        kind: "slider",
        max: 1,
        preset: m
      })
      appendLayerShaderFields(extraRows, extra.shader, params)
    }
    return extraRows
  }
  return []
}

function layerHeading(visual, slot, shaderA, shaderB, shaderC) {
  var m = normalizedMode(visual)
  if (m === "custom")
    return slot === 0 ? "Layer A" : (slot === 1 ? "Layer B" : "Layer C")
  var recipe = mixRecipe(m, shaderA, shaderB, shaderC)
  if (recipe && recipe.layers[slot])
    return recipe.layers[slot].label
  if (slot === 2 && extraRainbowLayer(m))
    return "Rainbow"
  return "Parameters"
}

function fieldsForPanel(visual, shaderA, shaderB, shaderC, params) {
  return fieldsForVisualLayer(visual, 0, shaderA, shaderB, shaderC, params)
    .concat(fieldsForVisualLayer(visual, 1, shaderA, shaderB, shaderC, params))
    .concat(fieldsForVisualLayer(visual, 2, shaderA, shaderB, shaderC, params))
}

function hasTweaks(mode) {
  var m = normalizedMode(mode)
  if (m === "none" || m === "follow" || m === "exclusive") return false
  return isVisualPreset(m)
}

function fieldsForMode(mode) {
  return fieldsForPanel(mode)
}

function isCheckParam(key) {
  var k = String(key || "")
  return k === "enableC" || k === "nightVisible"
}

function fieldMaximum(mode, key) {
  var k = String(key || "")
  if (k === "strength" || k === "strengthA" || k === "strengthB" || k === "strengthC" || isCheckParam(k)) return 1
  if (k === "refract" || k === "haze") return 1
  if (k === "temperature") return 49
  var fields = tweakFields[normalizedMode(mode)] || []
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].key === k && fields[i].max) return fields[i].max
  }
  var m = normalizedMode(mode)
  if (k === "density" && (m === "rain" || m === "stormy")) return 2.4
  if (k === "scale" && (m === "rain" || m === "stormy")) return 1
  if (k === "scale" && m === "rainbow") return 4
  return 2
}

function fieldMinimum(mode, key) {
  var fields = tweakFields[normalizedMode(mode)] || []
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].key === String(key || "") && fields[i].min !== undefined && fields[i].min !== null)
      return fields[i].min
  }
  return 0
}

function fieldNudgeStep(field) {
  if (!field) return 0.1
  if (field.kind === "check") return 1
  if (field.format === "temp" || field.key === "temperature") return 1
  if (field.key === "strength" || field.key === "strengthA" || field.key === "strengthB" || field.key === "strengthC") return 0.05
  return 0.1
}

function clampParam(key, value, mode) {
  var n = parseFloat(value)
  if (isNaN(n)) {
    if (isCheckParam(key)) n = 0
    else if (key === "strengthA" || key === "strengthB" || key === "strengthC") n = 0.5
    else if (key === "temperature") n = defaultHazeTempC
    else n = 1
  }
  if (key === "temperature" && n <= 1)
    n = defaultHazeTempC
  if (isCheckParam(key)) return n >= 0.5 ? 1 : 0
  return Math.max(fieldMinimum(mode, key), Math.min(fieldMaximum(mode, key), n))
}

function mergeParams(raw) {
  var defaults = defaultParams()
  var src = raw && typeof raw === "object" ? raw : {}
  var out = {}
  for (var preset in defaults) {
    out[preset] = {}
    var from = src[preset] && typeof src[preset] === "object" ? src[preset] : {}
    for (var key in defaults[preset]) {
      out[preset][key] = from[key] === undefined || from[key] === null
        ? defaults[preset][key]
        : clampParam(key, from[key], preset)
    }
  }
  return out
}

function paramValue(params, preset, key, fallback) {
  if (!params || !params[preset] || params[preset][key] === undefined || params[preset][key] === null)
    return fallback
  var n = parseFloat(params[preset][key])
  return isNaN(n) ? fallback : n
}

function shaderFileForMode(mode, weatherPreset, exclusivePreset) {
  var m = normalizedMode(mode)
  if (m === "follow") return shaderFileForPreset(weatherPreset || "sunny")
  if (m === "exclusive") return shaderFileForPreset(normalizedExclusivePreset(exclusivePreset))
  return shaderFileForPreset(m)
}

function displayNameForShader(filename) {
  var name = String(filename || "").replace(/^.*\//, "")
  name = name.replace(/\.frag\.qsb$/i, "").replace(/\.qsb$/i, "").replace(/\.frag$/i, "")
  return name
}

function parseHyprShaderRivals(raw) {
  var lines = String(raw || "").split("\n")
  var out = []
  var seen = {}
  for (var i = 0; i < lines.length; i++) {
    var line = String(lines[i] || "").replace(/^\s+|\s+$/g, "")
    if (!line) continue
    var tab = line.indexOf("\t")
    var id = tab >= 0 ? line.substring(0, tab) : line
    var name = tab >= 0 ? line.substring(tab + 1) : id
    if (!id || seen[id]) continue
    seen[id] = true
    out.push({ id: id, name: name || id })
  }
  return out
}

function hyprShaderRivalWarning(rivals) {
  var list = rivals || []
  if (!list.length) return ""
  var names = []
  for (var i = 0; i < list.length; i++)
    names.push(list[i].name || list[i].id)
  var who = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]
  return "Hyprland only has one screen shader. " + who
    + " also apply one, so rain refraction and haze may lose if that plugin applied last."
}

function shaderFilesFromListing(raw) {
  var lines = String(raw || "").split("\n")
  var out = []
  var seen = {}
  for (var i = 0; i < lines.length; i++) {
    var name = String(lines[i] || "").replace(/^\s+|\s+$/g, "").replace(/^.*\//, "")
    if (name === "" || !/\.qsb$/i.test(name)) continue
    if (seen[name]) continue
    seen[name] = true
    out.push(name)
  }
  return out
}

function fileUrlToPath(url) {
  var text = String(url || "")
  if (text.indexOf("file://") === 0) return text.substring(7)
  return text
}

function wrapDegrees(value) {
  var n = value % 360
  return n < 0 ? n + 360 : n
}

function wrapHours(value) {
  var n = value % 24
  return n < 0 ? n + 24 : n
}

// Solar altitude in degrees from lat/lon (positive = above horizon).
function solarElevationDeg(latitude, longitude, date) {
  var ms = date.getTime()
  var jd = ms / 86400000 + 2440587.5
  var n = jd - 2451545.0
  var rad = Math.PI / 180
  var L = wrapDegrees(280.460 + 0.9856474 * n)
  var g = wrapDegrees(357.528 + 0.9856003 * n) * rad
  var lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad
  var epsilon = (23.439 - 0.0000004 * n) * rad
  var decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda))
  var ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda))
  var gmst = wrapHours(18.697374558 + 24.06570982441908 * n)
  var lst = wrapHours(gmst + longitude / 15)
  var ha = lst * 15 * rad - ra
  var latR = latitude * rad
  var sinAlt = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha)
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad
}

function clockElevationDeg(date) {
  var minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
  return Math.cos((minutes / 1440 - 0.5) * 2 * Math.PI) * 30
}

// 0 = daylight, 1 = full night. Blends across civil twilight (0° to -6°).
function nightFactor(latitude, longitude, nowMs) {
  var date = new Date(nowMs || Date.now())
  var lat = parseFloat(String(latitude))
  var lon = parseFloat(String(longitude))
  var alt = (!isNaN(lat) && !isNaN(lon))
    ? solarElevationDeg(lat, lon, date)
    : clockElevationDeg(date)
  if (alt >= 0) return 0
  if (alt <= -6) return 1
  return (0 - alt) / 6
}

// weather.json holds {"name": ..., "latitude": ..., "longitude": ...}
// (omarchy-weather-location owns the format).
function parseLocationFile(raw) {
  var unset = { name: "", latitude: null, longitude: null }
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return unset

    var latitude = parseFloat(data.latitude)
    var longitude = parseFloat(data.longitude)
    var hasCoordinates = !isNaN(latitude) && !isNaN(longitude)
    return {
      name: typeof data.name === "string" ? data.name.replace(/^\s+|\s+$/g, "") : "",
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null,
      hasCoordinates: hasCoordinates
    }
  } catch (e) {
    return unset
  }
}

function wttrLocationQuery(location, latitude, longitude) {
  var lat = parseFloat(String(latitude))
  var lon = parseFloat(String(longitude))
  if (!isNaN(lat) && !isNaN(lon)) return lat + "," + lon

  var name = String(location || "").replace(/^\s+|\s+$/g, "")
  return name === "" ? "" : encodeURIComponent(name)
}

// Open-Meteo WMO codes, grouped the same way omarchy.weather maps them
// through iconForOpenMeteoCode → wttr icon groups.
function parseWeatherCode(code) {
  if (code === undefined || code === null || code === "") return NaN
  return parseInt(String(code), 10)
}

function presetForOpenMeteoCode(code) {
  var c = parseWeatherCode(code)
  if (isNaN(c)) return ""
  if (c === 0) return "sunny"
  if (c === 1 || c === 2) return "partly"
  if (c === 3) return "overcast"
  if (c === 45 || c === 48) return "fog"
  if (c === 51 || c === 53 || c === 55) return "drizzle"
  if (c === 56 || c === 57 || c === 66 || c === 67) return "wintry"
  if (c === 61 || c === 63 || c === 65 || c === 80 || c === 81 || c === 82) return "rain"
  if (c === 71 || c === 73) return "snow"
  if (c === 75 || c === 77 || c === 85 || c === 86) return "squall"
  if (c === 95 || c === 96 || c === 99) return "stormy"
  return "overcast"
}

// wttr.in weatherCode groups from omarchy-weather-icon / Model.iconForCode.
function presetForWttrCode(code) {
  var c = parseWeatherCode(code)
  if (isNaN(c)) return ""
  if (c === 113) return "sunny"
  if (c === 116) return "partly"
  if (c === 119 || c === 122) return "overcast"
  if (c === 143 || c === 248 || c === 260) return "fog"
  if (c === 176 || c === 263 || c === 353) return "drizzle"
  if (c === 179 || c === 227 || c === 230 || c === 323 || c === 326 || c === 368) return "snow"
  if (c === 182 || c === 185 || c === 281 || c === 284 || c === 311 || c === 314) return "wintry"
  if (c === 317 || c === 320 || c === 350 || c === 362 || c === 365 || c === 374 || c === 377) return "wintry"
  if (c === 200 || c === 386 || c === 389 || c === 392 || c === 395) return "stormy"
  if (c === 266 || c === 293 || c === 296) return "drizzle"
  if (c === 299 || c === 302 || c === 305 || c === 308 || c === 356 || c === 359) return "rain"
  if (c === 329 || c === 332 || c === 335 || c === 338 || c === 371) return "squall"
  return "overcast"
}

function tempCFromOpenMeteoJson(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    var current = data && data.current ? data.current : null
    if (!current) return NaN
    var t = parseFloat(current.temperature_2m)
    return isNaN(t) ? NaN : t
  } catch (e) {
    return NaN
  }
}

function tempCFromWttrJson(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    var current = data && data.current_condition && data.current_condition[0] ? data.current_condition[0] : null
    if (!current) return NaN
    var t = parseFloat(current.temp_C)
    return isNaN(t) ? NaN : t
  } catch (e) {
    return NaN
  }
}

function presetFromOpenMeteoJson(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    var current = data && data.current ? data.current : null
    if (!current) return ""
    var code = current.weather_code
    if (code === undefined || code === null) return ""
    return presetForOpenMeteoCode(code)
  } catch (e) {
    return ""
  }
}

function presetFromWttrJson(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    var current = data && data.current_condition && data.current_condition[0] ? data.current_condition[0] : null
    if (!current) return ""
    var code = current.weatherCode
    if (code === undefined || code === null) return ""
    return presetForWttrCode(code)
  } catch (e) {
    return ""
  }
}
