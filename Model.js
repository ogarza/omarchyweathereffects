// Modes, weather-code → preset mapping (mirrors omarchy.weather /
// omarchy-weather-icon groups), and shader filename helpers.

var modes = [
  { value: "rain", label: "Rain", icon: "󰖗" },
  { value: "snow", label: "Snow", icon: "󰖘" },
  { value: "fog", label: "Cloud/Fog", icon: "󰖑" },
  { value: "sunny", label: "Sunny", icon: "󰖙" },
  { value: "stormy", label: "Stormy", icon: "󰖓" },
  { value: "fire", label: "Fire", icon: "󰈸" },
  { value: "follow", label: "Follow", icon: "󰔏" }
]

var modeValues = {
  rain: true,
  snow: true,
  fog: true,
  sunny: true,
  stormy: true,
  fire: true,
  follow: true
}

function modeEntry(value) {
  var v = String(value || "")
  for (var i = 0; i < modes.length; i++) {
    if (modes[i].value === v) return modes[i]
  }
  return modes[0]
}

function normalizedMode(value) {
  var v = String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
  if (v === "cloud" || v === "cloud/fog" || v === "cloud-fog" || v === "clouds") return "fog"
  if (modeValues[v]) return v
  return "rain"
}

function labelForMode(value) {
  return modeEntry(normalizedMode(value)).label
}

function iconForMode(value) {
  return modeEntry(value).icon
}

function labelForPreset(preset) {
  var v = String(preset || "")
  if (v === "fog") return "Cloud/Fog"
  if (v === "rain") return "Rain"
  if (v === "snow") return "Snow"
  if (v === "sunny") return "Sunny"
  if (v === "stormy") return "Stormy"
  if (v === "fire") return "Fire"
  return labelForMode(v)
}

function shaderFileForPreset(preset) {
  var v = String(preset || "sunny")
  if (v === "fog") return "fog.frag.qsb"
  if (v === "snow") return "snow.frag.qsb"
  if (v === "sunny") return "sunny.frag.qsb"
  if (v === "stormy") return "stormy.frag.qsb"
  if (v === "fire") return "fire.frag.qsb"
  return "rain.frag.qsb"
}

var tweakFields = {
  rain: [
    { key: "density", label: "Density" },
    { key: "speed", label: "Speed" },
    { key: "scale", label: "Scale" }
  ],
  snow: [
    { key: "density", label: "Density" },
    { key: "speed", label: "Speed" },
    { key: "scale", label: "Scale" }
  ],
  fog: [
    { key: "density", label: "Density" },
    { key: "speed", label: "Speed" }
  ],
  sunny: [
    { key: "glow", label: "Glow" },
    { key: "speed", label: "Speed" }
  ],
  stormy: [
    { key: "density", label: "Density" },
    { key: "speed", label: "Speed" },
    { key: "scale", label: "Scale" },
    { key: "lightning", label: "Lightning" }
  ],
  fire: [
    { key: "density", label: "Density" },
    { key: "speed", label: "Speed" },
    { key: "scale", label: "Scale" },
    { key: "glow", label: "Glow" }
  ]
}

function defaultParams() {
  return {
    rain: { strength: 1, density: 1, speed: 1, scale: 1 },
    snow: { strength: 1, density: 1, speed: 1, scale: 1 },
    fog: { strength: 1, density: 1, speed: 1 },
    sunny: { strength: 1, glow: 1, speed: 1 },
    stormy: { strength: 1, density: 1, speed: 1, scale: 1, lightning: 1 },
    fire: { strength: 1, density: 1, speed: 1, scale: 1, glow: 1 }
  }
}

function hasTweaks(mode) {
  return !!tweakFields[normalizedMode(mode)]
}

function fieldsForMode(mode) {
  return tweakFields[normalizedMode(mode)] || []
}

function clampParam(key, value) {
  var n = parseFloat(value)
  if (isNaN(n)) n = key === "strength" ? 1 : 1
  if (key === "strength") return Math.max(0, Math.min(1, n))
  return Math.max(0, Math.min(2, n))
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
        : clampParam(key, from[key])
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

function shaderFileForMode(mode, weatherPreset) {
  var m = normalizedMode(mode)
  if (m === "follow") return shaderFileForPreset(weatherPreset || "sunny")
  return shaderFileForPreset(m)
}

function displayNameForShader(filename) {
  var name = String(filename || "").replace(/^.*\//, "")
  name = name.replace(/\.frag\.qsb$/i, "").replace(/\.qsb$/i, "").replace(/\.frag$/i, "")
  return name
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
function presetForOpenMeteoCode(code) {
  var c = parseInt(String(code || ""), 10)
  if (isNaN(c)) return ""
  if (c === 0 || c === 1 || c === 2) return "sunny"
  if (c === 3 || c === 45 || c === 48) return "fog"
  if (c === 51 || c === 53 || c === 55 || c === 56 || c === 57 || c === 61) return "rain"
  if (c === 63 || c === 65 || c === 66 || c === 67 || c === 80 || c === 81 || c === 82) return "rain"
  if (c === 71 || c === 73 || c === 75 || c === 77 || c === 85 || c === 86) return "snow"
  if (c === 95 || c === 96 || c === 99) return "stormy"
  return "fog"
}

// wttr.in weatherCode groups from omarchy-weather-icon / Model.iconForCode.
function presetForWttrCode(code) {
  var c = parseInt(String(code || ""), 10)
  if (isNaN(c)) return ""
  if (c === 113 || c === 116) return "sunny"
  if (c === 119 || c === 122 || c === 143 || c === 248 || c === 260) return "fog"
  if (c === 176 || c === 263 || c === 353) return "rain"
  if (c === 179 || c === 227 || c === 230 || c === 323 || c === 326 || c === 368) return "snow"
  if (c === 182 || c === 185 || c === 281 || c === 284 || c === 311 || c === 314) return "rain"
  if (c === 317 || c === 320 || c === 350 || c === 362 || c === 365 || c === 374 || c === 377) return "rain"
  if (c === 200 || c === 386 || c === 389 || c === 392 || c === 395) return "stormy"
  if (c === 266 || c === 293 || c === 296 || c === 299 || c === 302 || c === 305 || c === 308 || c === 356 || c === 359) return "rain"
  if (c === 329 || c === 332 || c === 335 || c === 338 || c === 371) return "snow"
  return "fog"
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
