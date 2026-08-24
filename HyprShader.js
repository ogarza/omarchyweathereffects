.pragma library

// Hyprland decoration.screen_shader source. Uniform names must match
// Hyprland Shader.cpp: tex, fullSize (aliases screen_size/screenSize),
// time, pointer_position. All look knobs are baked consts — Hyprland
// does not accept a custom uniform block.
//
// Raindrop surface / placement is ported from shaders/rain.frag
// (YeHaike "Raindrops on glass", ShaderToy DdKyR1; Heartfelt / BigWings).
// See THIRD_PARTY_NOTICES.md.

function clamp(v, lo, hi) {
  v = Number(v)
  if (isNaN(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

function f(v) { return Number(v).toFixed(5) }

function kindHas(kind, token) {
  var parts = String(kind || "").split("+")
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === token) return true
  }
  return false
}

function sanitize(p) {
  p = p && typeof p === "object" ? p : {}
  var kind = String(p.kind || "")
  var rain = kindHas(kind, "rain")
  var haze = kindHas(kind, "haze")
  var hazeAmt = haze ? clamp(p.haze, 0.0, 1.0) : 0.0
  return {
    rain: rain,
    stormRain: rain && !!p.stormRain,
    density: clamp(p.density, 0.0, 2.4),
    speed: clamp(p.speed, 0.0, 2.0),
    scale: clamp(p.scale, 0.05, 1.0),
    glow: clamp(p.glow, 0.0, 2.0),
    strength: clamp(p.strength, 0.0, 1.0),
    refract: clamp(p.refract, 0.0, 1.0),
    quality: clamp(p.quality, 0.0, 3.0),
    haze: haze && hazeAmt > 0.001 ? hazeAmt : 0,
    fireHaze: !!p.fireHaze,
    pixelRatio: clamp(p.pixelRatio, 1.0, 4.0),
    azimuth: clamp(p.azimuth, 0.0, 2.0)
  }
}

function rainHelpers(stormRain) {
  return ""
    + "const float RandomSeed = 4.3315;\n"
    + "const float NumberScaleOfStaticRaindrops = " + (stormRain ? "0.21" : "0.35") + ";\n"
    + "const float NumberScaleOfRollingRaindrops = " + (stormRain ? "0.315" : "0.35") + ";\n"
    + "const float StaticRaindropUVScale = 20.0;\n"
    + "const float RollingRaindropUVScaleLayer01 = 2.25;\n"
    + "const float RollingRaindropUVScaleLayer02 = 2.25;\n"
    + "const float GridWrap = 128.0;\n\n"
    + "vec2 wrapId(vec2 id) {\n"
    + "  return vec2(mod(id.x, 256.0), mod(id.y, GridWrap));\n"
    + "}\n\n"
    + "float GradientWave(float b, float t) {\n"
    + "  return smoothstep(0.0, b, t) * smoothstep(1.0, b, t);\n"
    + "}\n\n"
    + "float Random(vec2 uv, float seed) {\n"
    + "  vec3 p3 = fract(vec3(uv.xyx) * 0.1031 + seed);\n"
    + "  p3 += dot(p3, p3.yzx + 33.33);\n"
    + "  return fract((p3.x + p3.y) * p3.z);\n"
    + "}\n\n"
    + "vec3 RandomVec3(vec2 uv, float seed) {\n"
    + "  return vec3(Random(uv, seed), Random(uv + vec2(17.13, 9.21), seed), Random(uv + vec2(3.71, 28.44), seed));\n"
    + "}\n\n"
    + "float EdgeNoise(vec2 p) {\n"
    + "  vec2 i = floor(p);\n"
    + "  vec2 f = fract(p);\n"
    + "  f = f * f * (3.0 - 2.0 * f);\n"
    + "  float a = Random(i, RandomSeed);\n"
    + "  float b = Random(i + vec2(1.0, 0.0), RandomSeed);\n"
    + "  float c = Random(i + vec2(0.0, 1.0), RandomSeed);\n"
    + "  float d = Random(i + vec2(1.0, 1.0), RandomSeed);\n"
    + "  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;\n"
    + "}\n\n"
    + "float MapToRange(float edge0, float edge1, float x) {\n"
    + "  return clamp((x - edge0) / max(edge1 - edge0, 1e-5), 0.0, 1.0);\n"
    + "}\n\n"
    + "float ProportionalMapToRange(float edge0, float edge1, float x) {\n"
    + "  return edge0 + (edge1 - edge0) * x;\n"
    + "}\n\n"
    + "vec3 RaindropSurface(vec2 xy, float distanceScale, float zScale) {\n"
    + "  float A = distanceScale;\n"
    + "  if (A <= 1e-4) return vec3(0.0);\n"
    + "  float x = xy.x;\n"
    + "  float y = xy.y;\n"
    + "  float N = 1.5;\n"
    + "  float M = 0.5;\n"
    + "  float S = zScale;\n"
    + "  float tempZ = 1.0 - (x * x + y * y) / (A * A);\n"
    + "  if (tempZ <= 0.0) return vec3(0.0);\n"
    + "  float Z = pow(tempZ, A * 0.5);\n"
    + "  float zInMN = (Z - M) / (N - M);\n"
    + "  float t = clamp(zInMN, 0.0, 1.0);\n"
    + "  float height = S * t * t * (3.0 - 2.0 * t);\n"
    + "  if (height <= 0.0) return vec3(0.0);\n"
    + "  float part01 = S * (6.0 * t - 8.0 * t * t);\n"
    + "  float part02 = 1.0 / (N - M);\n"
    + "  float part03 = (-1.0 / A) * pow(tempZ, A * 0.5 - 1.0);\n"
    + "  float tempValue = (zInMN > 0.0 && zInMN < 1.0) ? part01 * part02 : 0.0;\n"
    + "  vec2 partial = vec2(tempValue * x * part03, tempValue * y * part03);\n"
    + "  return vec3(height, partial);\n"
    + "}\n\n"
    + "vec3 StaticRaindrops(vec2 uv, float t, float uvScale) {\n"
    + "  vec2 tempUV = uv * uvScale;\n"
    + "  vec2 id = wrapId(floor(tempUV));\n"
    + "  vec3 rng = RandomVec3(vec2(id.x * 17.47, id.y * 19.53), RandomSeed);\n"
    + "  float visible = step(1.0 - clamp(NumberScaleOfStaticRaindrops * density, 0.0, 0.95), fract(rng.z * 10.0 * RandomSeed));\n"
    + "  if (visible < 0.5) return vec3(0.0);\n"
    + "  tempUV = fract(tempUV) - 0.5;\n"
    + "  vec2 randomPoint = (rng.xy - 0.5) * 0.25;\n"
    + "  vec2 xy = randomPoint - tempUV;\n"
    + "  vec2 direction = tempUV - randomPoint;\n"
    + "  float dirLen = length(direction);\n"
    + "  vec2 dirN = dirLen > 1e-5 ? direction / dirLen : vec2(0.0, 1.0);\n"
    + "  float edge = EdgeNoise(vec2(tempUV.x * 6.1, tempUV.y * 6.1)) * mix(0.02, 0.175, fract(rng.x));\n"
    + "  float fade = GradientWave(0.0005, fract(t * 0.02 + rng.z));\n"
    + "  float distanceMaxRange = 1.45 * fade;\n"
    + "  float theta = 3.141592653 - acos(clamp(dot(dirN, vec2(0.0, 1.0)), -1.0, 1.0));\n"
    + "  theta *= rng.z;\n"
    + "  float distanceScale = 0.2 / (1.0 - 0.8 * cos(theta - 3.141593 * 0.5 - 1.6));\n"
    + "  float yDistance = abs(tempUV.y - randomPoint.y);\n"
    + "  float sizeMul = max(min(scale, 1.0), 0.05);\n"
    + "  float dropSize = 1.65 * (0.2 + distanceScale) * distanceMaxRange * mix(1.5, 0.5, rng.x) * sizeMul;\n"
    + "  vec2 tempXY = vec2(xy.x, xy.y) * (4.0 / sizeMul);\n"
    + "  float randomScale = ProportionalMapToRange(0.85, 1.35, rng.z);\n"
    + "  float yStretch = max(smoothstep(1.0, 0.4, yDistance * rng.z), 0.15);\n"
    + "  tempXY.x = randomScale * mix(tempXY.x, tempXY.x / yStretch, smoothstep(1.0, 0.0, rng.x));\n"
    + "  tempXY += edge;\n"
    + "  vec3 hn = RaindropSurface(tempXY, dropSize, 1.0);\n"
    + "  return hn * visible;\n"
    + "}\n\n"
    + "vec4 RollingRaindrops(vec2 uv, float t, float uvScale) {\n"
    + "  vec2 localUV = uv * uvScale;\n"
    + "  vec2 tempUV = localUV;\n"
    + "  vec2 constantA = vec2(6.0, 1.0);\n"
    + "  vec2 gridNum = constantA * 2.0;\n"
    + "  vec2 gridID = wrapId(floor(localUV * gridNum));\n"
    + "  float randomFloat = Random(vec2(gridID.x * 13.26, gridID.x * 10.81), RandomSeed);\n"
    + "  float timeMovingY = t * 0.85 * ProportionalMapToRange(0.1, 0.25, randomFloat);\n"
    + "  localUV.y += timeMovingY + randomFloat;\n"
    + "  vec2 scaledUV = localUV * gridNum;\n"
    + "  scaledUV.y = mod(scaledUV.y, GridWrap);\n"
    + "  gridID = floor(scaledUV);\n"
    + "  vec3 rng = RandomVec3(vec2(gridID.x * 17.32, gridID.y * 19.54), RandomSeed);\n"
    + "  float visible = step(1.0 - clamp(NumberScaleOfRollingRaindrops * density, 0.0, 0.95), fract(rng.z * 20.0 * RandomSeed));\n"
    + "  if (visible < 0.5) return vec4(0.0);\n"
    + "  vec2 gridUV = fract(scaledUV) - vec2(0.5, 0.0);\n"
    + "  float swingX = rng.x - 0.5;\n"
    + "  float swingY = tempUV.y * 20.0;\n"
    + "  float swingPos = sin(swingY + sin(gridID.y * rng.z + swingY) + gridID.y * rng.z);\n"
    + "  swingX += swingPos * (0.5 - abs(swingX)) * (rng.z - 0.5);\n"
    + "  swingX *= 0.65;\n"
    + "  float randomNormalizedTime = fract(timeMovingY + rng.z);\n"
    + "  swingY = (GradientWave(0.87, randomNormalizedTime) - 0.5) * 0.9 + 0.5;\n"
    + "  swingY = clamp(swingY, 0.15, 0.85);\n"
    + "  vec2 position = vec2(swingX, swingY);\n"
    + "  vec2 xy = position - gridUV;\n"
    + "  vec2 direction = (gridUV - position) * constantA.yx;\n"
    + "  float dirLen = length(direction);\n"
    + "  vec2 dirN = dirLen > 1e-5 ? direction / dirLen : vec2(0.0, 1.0);\n"
    + "  float edge = EdgeNoise(vec2(tempUV.x * 10.264, tempUV.y * 15.588)) * mix(0.02, 0.175, fract(rng.y));\n"
    + "  float theta = 3.141592653 - acos(clamp(dot(dirN, vec2(0.0, 1.0)), -1.0, 1.0));\n"
    + "  theta *= rng.z;\n"
    + "  float distanceScale = 0.2 / (1.0 - 0.8 * cos(theta - 3.141593 * 0.5 - 1.6));\n"
    + "  float sizeMul = max(min(scale, 1.0), 0.05);\n"
    + "  float dropSize = 1.65 * (0.2 + distanceScale) * 1.45 * mix(1.0, 0.25, rng.x) * sizeMul;\n"
    + "  vec2 tempXY = vec2(xy.x, xy.y) * (4.0 / sizeMul);\n"
    + "  tempXY = tempXY * vec2(1.0, 4.2) + edge * 0.85;\n"
    + "  vec3 heightAndNormal = RaindropSurface(tempXY, dropSize, 1.0);\n"
    + "  float trailY = pow(smoothstep(1.0, swingY, gridUV.y), 0.5);\n"
    + "  float trailX = abs(gridUV.x - swingX) * mix(0.8, 4.0, smoothstep(0.0, 1.0, rng.x)) / sizeMul;\n"
    + "  float trail = smoothstep(0.25 * trailY, 0.15 * trailY * trailY, trailX);\n"
    + "  float trailClamp = smoothstep(-0.02 * sizeMul, 0.02 * sizeMul, gridUV.y - swingY);\n"
    + "  trail *= trailClamp * trailY;\n"
    + "  float signOfTrailX = sign(gridUV.x - swingX);\n"
    + "  if (signOfTrailX == 0.0) signOfTrailX = 1.0;\n"
    + "  float trailEdge = EdgeNoise(vec2(tempUV.x * 10.264 * signOfTrailX, tempUV.y * 15.588))\n"
    + "      * mix(0.002, 0.175, fract(rng.y));\n"
    + "  float trailXDistance = MapToRange(0.0, 0.1, trailEdge * 0.5 + trailX);\n"
    + "  vec2 trailDirection = signOfTrailX * vec2(1.0, 0.0) + vec2(0.0, 1.0) * smoothstep(1.0, 0.0, trail) * 0.5;\n"
    + "  vec3 trailHN = RaindropSurface(trailDirection * (trailXDistance / sizeMul), sizeMul, 1.0);\n"
    + "  trailHN *= pow(trail * rng.y, 2.0);\n"
    + "  trailHN.x = smoothstep(0.0, 1.0, trailHN.x);\n"
    + "  float remainTrail = smoothstep(0.2 * trailY, 0.0, trailX);\n"
    + "  float remainDroplet = max(0.0, (sin(tempUV.y * (1.0 - tempUV.y) * 120.0) - gridUV.y))\n"
    + "      * remainTrail * trailClamp * rng.z;\n"
    + "  float remainY = fract(tempUV.y * 10.0) + (gridUV.y - 0.5);\n"
    + "  vec2 remainXY = (gridUV - vec2(swingX, remainY)) * vec2(1.2, 0.8) / sizeMul + edge * 0.85;\n"
    + "  vec3 remainHN = RaindropSurface(remainXY, 2.0 * remainDroplet * sizeMul, 1.0);\n"
    + "  remainHN.x = smoothstep(0.0, 1.0, remainHN.x);\n"
    + "  remainHN = trailHN.x > 0.0 ? vec3(0.0) : remainHN;\n"
    + "  vec4 outv;\n"
    + "  outv.x = heightAndNormal.x + trailHN.x * trailY * trailClamp + remainHN.x * trailY * trailClamp;\n"
    + "  outv.yz = heightAndNormal.yz + trailHN.yz + remainHN.yz;\n"
    + "  outv.w = trail;\n"
    + "  return outv * visible;\n"
    + "}\n\n"
    + (stormRain
      ? ""
        + "vec2 stormWind() {\n"
        + "  float lean = mix(-0.62, 1.86, clamp(AZIMUTH, 0.0, 2.0) * 0.5);\n"
        + "  return normalize(vec2(lean, -1.0));\n"
        + "}\n\n"
        + "vec2 windSpace(vec2 uv, vec2 wind) {\n"
        + "  vec2 w = normalize(wind);\n"
        + "  vec2 perp = vec2(-w.y, w.x);\n"
        + "  return vec2(dot(uv, perp), -dot(uv, w));\n"
        + "}\n\n"
        + "vec4 Raindrops(vec2 uv, float t) {\n"
        + "  vec2 windUV = windSpace(uv, stormWind());\n"
        + "  vec4 roll1 = RollingRaindrops(windUV, t, RollingRaindropUVScaleLayer01);\n"
        + "  vec3 stat = StaticRaindrops(uv, t, StaticRaindropUVScale);\n"
        + "  vec4 roll2 = quality < 0.5 ? vec4(0.0) : RollingRaindrops(windUV * 1.7, t, RollingRaindropUVScaleLayer02);\n"
        + "  vec4 roll3 = quality < 2.5 ? vec4(0.0) : RollingRaindrops(windUV * 2.35, t, RollingRaindropUVScaleLayer02 * 1.15);\n"
        + "  float height = stat.x + roll1.x + roll2.x + roll3.x;\n"
        + "  vec2 deriv = stat.yz + roll1.yz + roll2.yz + roll3.yz;\n"
        + "  float trail = max(max(roll1.w, roll2.w), roll3.w);\n"
        + "  return vec4(height, deriv, trail);\n"
        + "}\n\n"
      : ""
        + "vec4 Raindrops(vec2 uv, float t) {\n"
        + "  vec4 roll1 = RollingRaindrops(uv, t, RollingRaindropUVScaleLayer01);\n"
        + "  vec3 stat = StaticRaindrops(uv, t, StaticRaindropUVScale);\n"
        + "  vec4 roll2 = quality < 0.5 ? vec4(0.0) : RollingRaindrops(uv * 1.7, t, RollingRaindropUVScaleLayer02);\n"
        + "  vec4 roll3 = quality < 2.5 ? vec4(0.0) : RollingRaindrops(uv * 2.35, t, RollingRaindropUVScaleLayer02 * 1.15);\n"
        + "  float height = stat.x + roll1.x + roll2.x + roll3.x;\n"
        + "  vec2 deriv = stat.yz + roll1.yz + roll2.yz + roll3.yz;\n"
        + "  float trail = max(max(roll1.w, roll2.w), roll3.w);\n"
        + "  return vec4(height, deriv, trail);\n"
        + "}\n\n")
}

function hazeHelpers() {
  return ""
    + "float hash21(vec2 p) {\n"
    + "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);\n"
    + "}\n\n"
    + "float vnoise(vec2 p) {\n"
    + "  vec2 i = floor(p);\n"
    + "  vec2 f = fract(p);\n"
    + "  f = f * f * (3.0 - 2.0 * f);\n"
    + "  float a = hash21(i);\n"
    + "  float b = hash21(i + vec2(1.0, 0.0));\n"
    + "  float c = hash21(i + vec2(0.0, 1.0));\n"
    + "  float d = hash21(i + vec2(1.0, 1.0));\n"
    + "  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);\n"
    + "}\n\n"
}

function build(params) {
  var p = sanitize(params)
  if (!p.rain && !p.haze) return ""

  var s = ""
  s += "#version 300 es\n"
  s += "precision highp float;\n\n"
  s += "// Generated by ogarza.weather. Edits here are overwritten.\n"
  s += "in vec2 v_texcoord;\n"
  s += "uniform sampler2D tex;\n"
  s += "uniform vec2 fullSize;\n"
  s += "uniform float time;\n"
  s += "\nlayout(location = 0) out vec4 fragColor;\n\n"

  if (p.rain) {
    s += "const float density  = " + f(p.density) + ";\n"
    s += "const float scale    = " + f(p.scale) + ";\n"
    s += "const float quality  = " + f(p.quality) + ";\n"
    s += "const float SPEED    = " + f(p.speed) + ";\n"
    s += "const float STRENGTH = " + f(p.strength) + ";\n"
    s += "const float REFRACT  = " + f(p.refract) + ";\n"
    s += "const float SHEEN    = " + f(p.glow) + ";\n"
    s += "const float PIXEL_RATIO = " + f(p.pixelRatio) + ";\n"
    if (p.stormRain) {
      s += "const float AZIMUTH  = " + f(p.azimuth) + ";\n"
      s += "const float STORM_TIME = 1.45000;\n"
    }
  }
  if (p.haze) {
    s += "const float HAZE     = " + f(p.haze) + ";\n"
  }
  s += "\n"

  if (p.rain) s += rainHelpers(p.stormRain)
  if (p.haze) s += hazeHelpers()

  s += "void main() {\n"
  s += "  vec2 res = max(fullSize, vec2(1.0));\n"
  s += "  vec2 texel = 1.0 / res;\n"
  s += "  vec2 uv = v_texcoord;\n\n"

  if (p.haze) {
    s += "  {\n"
    s += "    // Rising air expands: fine at the ground, longer wavelength and\n"
    s += "    // slower climb as loft increases (uv.y is 1 at the bottom).\n"
    s += "    float loft = 1.0 - uv.y;\n"
    s += "    float expand = 1.0 + 3.2 * loft * loft;\n"
    s += "    vec2 field = vec2((uv.x - 0.5) * res.x / (6.5 * expand),\n"
    s += "                     uv.y * res.y / 6.5 - time * 8.5 / expand);\n"
    s += "    float n1 = vnoise(field) * 2.0 - 1.0;\n"
    s += "    float n2 = vnoise(field * 2.3 + vec2(3.1, time * 2.4 / expand)) * 2.0 - 1.0;\n"
    s += "    vec2 heat = vec2(n1 + n2 * 0.45, (n2 - n1) * 0.28);\n"
    if (p.fireHaze) {
      s += "    float band = smoothstep(0.38, 1.0, uv.y);\n"
      s += "    band *= band;\n"
    } else {
      s += "    float yn = uv.y * 2.0 - 1.0;\n"
      s += "    float band = smoothstep(-1.05, 0.85, yn);\n"
      s += "    band *= band;\n"
    }
    s += "    uv += heat * HAZE * 0.0002 * band;\n"
    s += "    uv = clamp(uv, texel * 2.0, 1.0 - texel * 2.0);\n"
    s += "  }\n\n"
  }

  if (p.rain) {
    s += "  float unit = 1080.0 * PIXEL_RATIO;\n"
    s += "  vec2 frag = vec2(v_texcoord.x, 1.0 - v_texcoord.y) * res;\n"
    s += "  vec2 rainUV = (frag - 0.5 * res) / unit;\n"
    s += "  vec4 rain = Raindrops(rainUV, time * max(SPEED, 0.0)" + (p.stormRain ? " * STORM_TIME" : "") + ");\n"
    s += "  float h = rain.x;\n"
    s += "  vec2 deriv = rain.yz;\n"
    s += "  float trail = rain.w;\n"
    s += "  vec2 slope = deriv * 0.85;\n"
    s += "  vec3 N = normalize(vec3(-slope, 1.0));\n"
    s += "  float body = smoothstep(0.0, 0.22, h);\n"
    s += "  float trailFilm = smoothstep(0.02, 0.45, trail) * (1.0 - body);\n"
    s += "  float cover = max(smoothstep(0.0, max(fwidth(h) * 2.35, 0.011), h),\n"
    s += "                   smoothstep(0.0, max(fwidth(trail) * 2.1, 0.035), trail));\n"
    s += "  float warpAmt = REFRACT * STRENGTH * 0.00225;\n"
    s += "  warpAmt *= mix(0.20, 1.0, smoothstep(0.0, 0.18, h));\n"
    s += "  warpAmt *= mix(1.0, 0.28, trailFilm);\n"
    s += "  warpAmt *= cover;\n"
    s += "  if (cover > 0.02)\n"
    s += "    uv += N.xy * warpAmt;\n"
    s += "  uv = clamp(uv, texel * 2.0, 1.0 - texel * 2.0);\n\n"
  }

  s += "  vec3 col = texture(tex, uv).rgb;\n"

  if (p.rain) {
    s += "  if (h > 0.0 || trail > 0.0) {\n"
    s += "    vec3 L = normalize(vec3(-0.34, 0.58, 0.74));\n"
    s += "    vec3 V = vec3(0.0, 0.0, 1.0);\n"
    s += "    vec3 Hv = normalize(L + V);\n"
    s += "    float ndotl = max(dot(N, L), 0.0);\n"
    s += "    float specBroad = pow(max(dot(N, Hv), 0.0), 28.0);\n"
    s += "    float spec = quality < 0.5 ? 0.0 : pow(max(dot(N, Hv), 0.0), quality > 2.5 ? 140.0 : 96.0);\n"
    s += "    float fresnel = pow(clamp(1.0 - max(N.z, 0.0), 0.0, 1.0), 6.5);\n"
    s += "    float steep = length(slope);\n"
    s += "    float meniscus = 0.0;\n"
    s += "    if (quality > 0.5)\n"
    s += "      meniscus = pow(smoothstep(0.28, 0.82, steep), 2.6) * smoothstep(0.0, 0.02, h)\n"
    s += "          * (1.0 - smoothstep(0.05, 0.16, h));\n"
    s += "    float body = smoothstep(0.0, 0.22, h);\n"
    s += "    float trailFilm = smoothstep(0.02, 0.45, trail) * (1.0 - smoothstep(0.15, 0.55, h));\n"
    s += "    float darken = body * mix(0.12, 0.04, ndotl) + trailFilm * 0.04;\n"
    s += "    float sheen = clamp(SHEEN, 0.0, 2.0);\n"
    s += "    float brighten = (meniscus * 0.22 + fresnel * 0.08 + spec * 0.70 + specBroad * 0.06) * sheen;\n"
    s += "    vec3 glass = vec3(0.78, 0.91, 1.0);\n"
    s += "    vec3 hi = glass * (meniscus * 0.70 + fresnel * 0.22 + spec * 1.35 + specBroad * 0.12)\n"
    s += "        * mix(0.55, 1.15, sheen * 0.5);\n"
    s += "    hi *= mix(0.70, 1.0, ndotl * 0.55 + 0.45);\n"
    s += "    col *= 1.0 - darken * 0.55 * STRENGTH * cover;\n"
    s += "    col += hi * brighten * STRENGTH * cover;\n"
    s += "  }\n"
  }

  s += "  fragColor = vec4(col, 1.0);\n"
  s += "}\n"
  return s
}
