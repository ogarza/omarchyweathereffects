#version 440

// Rain-on-glass overlay
//
// This implementation is substantially modified from and inspired by:
//
//   YeHaike, "Raindrops on glass"
//   ShaderToy: https://www.shadertoy.com/view/DdKyR1
//
//   The original work is © YeHaike. The original source identifies
//   the work as "All Rights Reserved" and states "NonCommercial,
//   No Copy, No Modify." This attribution does not change or grant
//   additional rights to the original work.
//
// The raindrop surface model and portions of the drop/trail placement
// are derived from the above work. This implementation adds substantial
// original modifications, including the rendering model, lighting,
// normals-based shading, Qt/OpenGL integration, parameterization,
// randomization/noise, scaling, and compositing.
//
// Additional inspiration/reference:
//
//   Martijn Steinrucken aka BigWings, "Heartfelt" (2017)
//   ShaderToy: https://www.shadertoy.com/view/ltffzl
//   Licensed under Creative Commons Attribution-NonCommercial-ShareAlike
//   3.0 Unported License.
//
// This file is part of ogarza's omarchy weather effects.
// See the repository's THIRD_PARTY_NOTICES.md for additional attribution
// and licensing information.

// Rain-on-glass overlay. Drop surface is YeHaike's raindrop equation
// (height + analytical normals). Placement/trails follow that Shadertoy
// model. Drawn as a transparent overlay: no scene texture, so lighting
// comes from the drop normals (meniscus, spec, and a dark lens side).

// Storm overlay on the rain-on-glass model: same Y-up mapping as rain.frag,
// faster rolling drops, a dark wash, lightning, and diagonal wind spray.

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float time;
    vec2 resolution;
    float pixelRatio;
    float strength;
    float density;
    float speed;
    float scale;
    float glow;
    float lightning;
};

const float RandomSeed = 4.3315;
const float NumberScaleOfStaticRaindrops = 0.28;
const float NumberScaleOfRollingRaindrops = 0.42;
const float StaticRaindropUVScale = 20.0;
const float RollingRaindropUVScaleLayer01 = 2.25;
const float RollingRaindropUVScaleLayer02 = 2.25;
const float GridWrap = 128.0;
const float StormTimeScale = 1.45;

vec2 wrapId(vec2 id) {
    return vec2(mod(id.x, 256.0), mod(id.y, GridWrap));
}

float GradientWave(float b, float t) {
    return smoothstep(0.0, b, t) * smoothstep(1.0, b, t);
}

float Random(vec2 uv, float seed) {
    vec3 p3 = fract(vec3(uv.xyx) * 0.1031 + seed);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 RandomVec3(vec2 uv, float seed) {
    return vec3(Random(uv, seed), Random(uv + vec2(17.13, 9.21), seed), Random(uv + vec2(3.71, 28.44), seed));
}

float EdgeNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = Random(i, RandomSeed);
    float b = Random(i + vec2(1.0, 0.0), RandomSeed);
    float c = Random(i + vec2(0.0, 1.0), RandomSeed);
    float d = Random(i + vec2(1.0, 1.0), RandomSeed);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
}

float MapToRange(float edge0, float edge1, float x) {
    return clamp((x - edge0) / max(edge1 - edge0, 1e-5), 0.0, 1.0);
}

float ProportionalMapToRange(float edge0, float edge1, float x) {
    return edge0 + (edge1 - edge0) * x;
}

vec3 RaindropSurface(vec2 xy, float distanceScale, float zScale) {
    float A = distanceScale;
    if (A <= 1e-4)
        return vec3(0.0);

    float x = xy.x;
    float y = xy.y;
    float N = 1.5;
    float M = 0.5;
    float S = zScale;

    float tempZ = 1.0 - (x * x + y * y) / (A * A);
    if (tempZ <= 0.0)
        return vec3(0.0);

    float Z = pow(tempZ, A * 0.5);
    float zInMN = (Z - M) / (N - M);
    float t = clamp(zInMN, 0.0, 1.0);
    float height = S * t * t * (3.0 - 2.0 * t);
    if (height <= 0.0)
        return vec3(0.0);

    float part01 = S * (6.0 * t - 8.0 * t * t);
    float part02 = 1.0 / (N - M);
    float part03 = (-1.0 / A) * pow(tempZ, A * 0.5 - 1.0);
    float tempValue = (zInMN > 0.0 && zInMN < 1.0) ? part01 * part02 : 0.0;

    vec2 partial = vec2(tempValue * x * part03, tempValue * y * part03);
    return vec3(height, partial);
}

vec3 StaticRaindrops(vec2 uv, float t, float uvScale) {
    vec2 tempUV = uv * uvScale;
    vec2 id = wrapId(floor(tempUV));
    vec3 rng = RandomVec3(vec2(id.x * 17.47, id.y * 19.53), RandomSeed);
    float visible = step(1.0 - clamp(NumberScaleOfStaticRaindrops * density, 0.0, 0.95), fract(rng.z * 10.0 * RandomSeed));
    if (visible < 0.5)
        return vec3(0.0);

    tempUV = fract(tempUV) - 0.5;
    vec2 randomPoint = (rng.xy - 0.5) * 0.25;
    vec2 xy = randomPoint - tempUV;
    vec2 direction = tempUV - randomPoint;
    float dirLen = length(direction);
    vec2 dirN = dirLen > 1e-5 ? direction / dirLen : vec2(0.0, 1.0);

    float edge = EdgeNoise(vec2(tempUV.x * 6.1, tempUV.y * 6.1)) * mix(0.02, 0.175, fract(rng.x));
    float fade = GradientWave(0.0005, fract(t * 0.02 + rng.z));
    float distanceMaxRange = 1.45 * fade;

    float theta = 3.141592653 - acos(clamp(dot(dirN, vec2(0.0, 1.0)), -1.0, 1.0));
    theta *= rng.z;
    float distanceScale = 0.2 / (1.0 - 0.8 * cos(theta - 3.141593 * 0.5 - 1.6));
    float yDistance = abs(tempUV.y - randomPoint.y);
    float sizeMul = max(scale, 0.05);
    float dropSize = 1.65 * (0.2 + distanceScale) * distanceMaxRange * mix(1.5, 0.5, rng.x) * sizeMul;

    vec2 tempXY = vec2(xy.x, xy.y) * (4.0 / sizeMul);
    float randomScale = ProportionalMapToRange(0.85, 1.35, rng.z);
    float yStretch = max(smoothstep(1.0, 0.4, yDistance * rng.z), 0.15);
    tempXY.x = randomScale * mix(tempXY.x, tempXY.x / yStretch, smoothstep(1.0, 0.0, rng.x));
    tempXY += edge;

    vec3 hn = RaindropSurface(tempXY, dropSize, 1.0);
    return hn * visible;
}

vec4 RollingRaindrops(vec2 uv, float t, float uvScale) {
    vec2 localUV = uv * uvScale;
    vec2 tempUV = localUV;
    vec2 constantA = vec2(6.0, 1.0);
    vec2 gridNum = constantA * 2.0;
    vec2 gridID = wrapId(floor(localUV * gridNum));

    float randomFloat = Random(vec2(gridID.x * 13.26, gridID.x * 10.81), RandomSeed);
    float timeMovingY = t * 1.15 * ProportionalMapToRange(0.1, 0.25, randomFloat);
    localUV.y += timeMovingY + randomFloat;

    vec2 scaledUV = localUV * gridNum;
    scaledUV.y = mod(scaledUV.y, GridWrap);
    gridID = floor(scaledUV);
    vec3 rng = RandomVec3(vec2(gridID.x * 17.32, gridID.y * 19.54), RandomSeed);
    float visible = step(1.0 - clamp(NumberScaleOfRollingRaindrops * density, 0.0, 0.95), fract(rng.z * 20.0 * RandomSeed));
    if (visible < 0.5)
        return vec4(0.0);

    vec2 gridUV = fract(scaledUV) - vec2(0.5, 0.0);

    float swingX = rng.x - 0.5;
    float swingY = tempUV.y * 20.0;
    float swingPos = sin(swingY + sin(gridID.y * rng.z + swingY) + gridID.y * rng.z);
    swingX += swingPos * (0.5 - abs(swingX)) * (rng.z - 0.5);
    swingX *= 0.65;

    float randomNormalizedTime = fract(timeMovingY + rng.z);
    swingY = (GradientWave(0.87, randomNormalizedTime) - 0.5) * 0.9 + 0.5;
    swingY = clamp(swingY, 0.15, 0.85);
    vec2 position = vec2(swingX, swingY);

    vec2 xy = position - gridUV;
    vec2 direction = (gridUV - position) * constantA.yx;
    float dirLen = length(direction);
    vec2 dirN = dirLen > 1e-5 ? direction / dirLen : vec2(0.0, 1.0);

    float edge = EdgeNoise(vec2(tempUV.x * 10.264, tempUV.y * 15.588)) * mix(0.02, 0.175, fract(rng.y));

    float theta = 3.141592653 - acos(clamp(dot(dirN, vec2(0.0, 1.0)), -1.0, 1.0));
    theta *= rng.z;
    float distanceScale = 0.2 / (1.0 - 0.8 * cos(theta - 3.141593 * 0.5 - 1.6));
    float sizeMul = max(scale, 0.05);
    float dropSize = 1.65 * (0.2 + distanceScale) * 1.45 * mix(1.0, 0.25, rng.x) * sizeMul;

    vec2 tempXY = vec2(xy.x, xy.y) * (4.0 / sizeMul);
    tempXY = tempXY * vec2(1.0, 4.2) + edge * 0.85;
    vec3 heightAndNormal = RaindropSurface(tempXY, dropSize, 1.0);

    float trailY = pow(smoothstep(1.0, swingY, gridUV.y), 0.5);
    float trailX = abs(gridUV.x - swingX) * mix(0.8, 4.0, smoothstep(0.0, 1.0, rng.x)) / sizeMul;
    float trail = smoothstep(0.25 * trailY, 0.15 * trailY * trailY, trailX);
    float trailClamp = smoothstep(-0.02 * sizeMul, 0.02 * sizeMul, gridUV.y - swingY);
    trail *= trailClamp * trailY;

    float signOfTrailX = sign(gridUV.x - swingX);
    if (signOfTrailX == 0.0)
        signOfTrailX = 1.0;
    float trailEdge = EdgeNoise(vec2(tempUV.x * 10.264 * signOfTrailX, tempUV.y * 15.588))
        * mix(0.002, 0.175, fract(rng.y));
    float trailXDistance = MapToRange(0.0, 0.1, trailEdge * 0.5 + trailX);
    vec2 trailDirection = signOfTrailX * vec2(1.0, 0.0) + vec2(0.0, 1.0) * smoothstep(1.0, 0.0, trail) * 0.5;
    vec3 trailHN = RaindropSurface(trailDirection * (trailXDistance / sizeMul), sizeMul, 1.0);
    trailHN *= pow(trail * rng.y, 2.0);
    trailHN.x = smoothstep(0.0, 1.0, trailHN.x);

    float remainTrail = smoothstep(0.2 * trailY, 0.0, trailX);
    float remainDroplet = max(0.0, (sin(tempUV.y * (1.0 - tempUV.y) * 120.0) - gridUV.y))
        * remainTrail * trailClamp * rng.z;
    float remainY = fract(tempUV.y * 10.0) + (gridUV.y - 0.5);
    vec2 remainXY = (gridUV - vec2(swingX, remainY)) * vec2(1.2, 0.8) / sizeMul + edge * 0.85;
    vec3 remainHN = RaindropSurface(remainXY, 2.0 * remainDroplet * sizeMul, 1.0);
    remainHN.x = smoothstep(0.0, 1.0, remainHN.x);
    remainHN = trailHN.x > 0.0 ? vec3(0.0) : remainHN;

    vec4 outv;
    outv.x = heightAndNormal.x + trailHN.x * trailY * trailClamp + remainHN.x * trailY * trailClamp;
    outv.yz = heightAndNormal.yz + trailHN.yz + remainHN.yz;
    outv.w = trail;
    return outv * visible;
}

vec2 windSpace(vec2 uv) {
    vec2 wind = normalize(vec2(0.62, -1.0));
    vec2 perp = vec2(-wind.y, wind.x);
    return vec2(dot(uv, perp), -dot(uv, wind));
}

vec4 Raindrops(vec2 uv, float t) {
    vec3 stat = StaticRaindrops(uv, t, StaticRaindropUVScale);
    vec2 windUV = windSpace(uv);
    vec4 roll1 = RollingRaindrops(windUV, t, RollingRaindropUVScaleLayer01);
    vec4 roll2 = RollingRaindrops(windUV * 1.7, t, RollingRaindropUVScaleLayer02);

    float height = stat.x + roll1.x + roll2.x;
    vec2 deriv = stat.yz + roll1.yz + roll2.yz;
    float trail = max(roll1.w, roll2.w);
    return vec4(height, deriv, trail);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
    return length(pa - ba * h);
}

float windSpray(vec2 frag, float t) {
    float dpr = max(pixelRatio, 1.0);
    vec2 wind = normalize(vec2(0.62, -1.0));
    float acc = 0.0;
    for (int i = 0; i < 22; i++) {
        float fi = float(i);
        float sx = Random(vec2(fi, 3.17), RandomSeed);
        float sy = Random(vec2(fi, 9.41), RandomSeed);
        float sp = 0.18 + sx * 0.32;
        vec2 pos = vec2(
            fract(sx + t * sp * 0.42) * resolution.x,
            fract(sy - t * sp * 0.70) * resolution.y
        );
        vec2 d = frag - pos;
        float along = dot(d, wind);
        float across = d.x * wind.y - d.y * wind.x;
        float len = mix(7.0, 16.0, sy) * dpr;
        float thick = mix(0.6, 1.3, sx) * dpr;
        float dash = smoothstep(thick, 0.0, abs(across)) * smoothstep(len, 0.0, abs(along));
        acc += dash * mix(0.25, 0.8, sx);
    }
    return acc;
}

vec2 boltVertex(float seed, float t, float x0) {
    float stepId = floor(t * 12.0 + 0.001);
    float wander = Random(vec2(seed, stepId + 0.3), RandomSeed) - 0.5;
    float fine = Random(vec2(seed, stepId + 8.7), RandomSeed) - 0.5;
    float x = x0
        + wander * resolution.x * mix(0.012, 0.055, t)
        + fine * resolution.x * 0.012
        + sin((t + seed) * 23.0) * resolution.x * 0.006;
    float y = mix(resolution.y * 0.98, resolution.y * 0.10, t);
    return vec2(x, y);
}

float strokeBolt(vec2 frag, vec2 a, vec2 b, float corePx, float glowPx) {
    float d = sdSegment(frag, a, b);
    float core = smoothstep(corePx, 0.0, d);
    float glow = smoothstep(glowPx, corePx, d);
    return core + glow * 0.18;
}

float lightningBolt(vec2 frag, float seed) {
    float dpr = max(pixelRatio, 1.0);
    float corePx = 1.05 * dpr;
    float glowPx = 3.6 * dpr;
    float x0 = (0.22 + Random(vec2(seed, 1.4), RandomSeed) * 0.56) * resolution.x;

    float acc = 0.0;
    vec2 prev = boltVertex(seed, 0.0, x0);
    for (int i = 1; i <= 12; i++) {
        float t = float(i) / 12.0;
        vec2 p = boltVertex(seed, t, x0);
        acc = max(acc, strokeBolt(frag, prev, p, corePx, glowPx));
        prev = p;
    }

    float forkT = 0.22 + Random(vec2(seed, 5.1), RandomSeed) * 0.28;
    vec2 f0 = boltVertex(seed, forkT, x0);
    float forkSign = Random(vec2(seed, 6.2), RandomSeed) < 0.5 ? -1.0 : 1.0;
    vec2 fdir = normalize(vec2(forkSign * mix(0.35, 0.7, Random(vec2(seed, 6.8), RandomSeed)), -1.0));
    float flen = resolution.y * mix(0.16, 0.28, Random(vec2(seed, 7.3), RandomSeed));
    vec2 fprev = f0;
    for (int j = 1; j <= 5; j++) {
        float u = float(j) / 5.0;
        vec2 jitter = vec2(
            (Random(vec2(seed, 21.0 + float(j)), RandomSeed) - 0.5) * resolution.x * 0.025,
            (Random(vec2(seed, 31.0 + float(j)), RandomSeed) - 0.5) * resolution.y * 0.01
        );
        vec2 fp = f0 + fdir * (flen * u) + jitter;
        acc = max(acc, strokeBolt(frag, fprev, fp, corePx * 0.75, glowPx * 0.75));
        fprev = fp;
    }

    float fork2T = 0.48 + Random(vec2(seed, 8.1), RandomSeed) * 0.18;
    vec2 g0 = boltVertex(seed, fork2T, x0);
    vec2 gdir = normalize(vec2(-forkSign * mix(0.25, 0.55, Random(vec2(seed, 8.6), RandomSeed)), -1.0));
    float glen = resolution.y * mix(0.08, 0.16, Random(vec2(seed, 9.0), RandomSeed));
    vec2 gprev = g0;
    for (int k = 1; k <= 4; k++) {
        float u = float(k) / 4.0;
        vec2 jitter = vec2(
            (Random(vec2(seed, 41.0 + float(k)), RandomSeed) - 0.5) * resolution.x * 0.02,
            0.0
        );
        vec2 gp = g0 + gdir * (glen * u) + jitter;
        acc = max(acc, strokeBolt(frag, gprev, gp, corePx * 0.6, glowPx * 0.6));
        gprev = gp;
    }

    return clamp(acc, 0.0, 1.0);
}

void main() {
    float dpr = max(pixelRatio, 1.0);
    float unit = 1080.0 * dpr;

    vec2 screen = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y);
    vec2 frag = screen * resolution;
    vec2 uv = (frag - 0.5 * resolution) / unit;

    vec4 rain = Raindrops(uv, time * StormTimeScale * max(speed, 0.0));
    float h = rain.x;
    vec2 deriv = rain.yz;
    float trail = rain.w;

    float darken = 0.0;
    float brighten = 0.0;
    vec3 col = vec3(0.0);

    if (h > 0.0 || trail > 0.0) {
        vec2 slope = deriv * 0.85;
        vec3 N = normalize(vec3(-slope, 1.0));
        vec3 L = normalize(vec3(-0.34, 0.58, 0.74));
        vec3 V = vec3(0.0, 0.0, 1.0);
        vec3 Hv = normalize(L + V);

        float ndotl = max(dot(N, L), 0.0);
        float spec = pow(max(dot(N, Hv), 0.0), 96.0);
        float specBroad = pow(max(dot(N, Hv), 0.0), 28.0);
        float fresnel = pow(clamp(1.0 - max(N.z, 0.0), 0.0, 1.0), 6.5);
        float steep = length(slope);

        float meniscus = pow(smoothstep(0.28, 0.82, steep), 2.6) * smoothstep(0.0, 0.02, h)
            * (1.0 - smoothstep(0.05, 0.16, h));
        float body = smoothstep(0.0, 0.22, h);
        float trailFilm = smoothstep(0.02, 0.45, trail) * (1.0 - smoothstep(0.15, 0.55, h));

        darken = body * mix(0.16, 0.06, ndotl) + trailFilm * 0.055;
        brighten = meniscus * 0.20 + fresnel * 0.07 + spec * 0.62 + specBroad * 0.05;

        vec3 glass = vec3(0.70, 0.82, 0.96);
        col = glass * (meniscus * 0.70 + fresnel * 0.22 + spec * 1.25 + specBroad * 0.12);
        col *= mix(0.62, 1.0, ndotl * 0.55 + 0.45);
    }

    float vignette = smoothstep(0.18, 1.08, length((screen - 0.5) * vec2(1.2, 1.0)));
    float wash = 0.11 + vignette * 0.12;
    vec3 washCol = vec3(0.04, 0.055, 0.08);

    float spray = windSpray(frag, time);
    vec3 sprayCol = vec3(0.78, 0.86, 0.95);

    float cycle = floor(time * 0.20);
    float phase = fract(time * 0.20);
    float strike = step(1.0 - 0.22 * clamp(lightning, 0.0, 2.0), Random(vec2(cycle, 11.0), RandomSeed));
    float flash = 0.0;
    float boltMask = 0.0;
    if (strike > 0.5 && phase < 0.11) {
        float flicker = step(0.32, Random(vec2(floor(time * 26.0), cycle), RandomSeed));
        flash = (1.0 - smoothstep(0.0, 0.11, phase)) * flicker;
        boltMask = lightningBolt(frag, cycle) * flash;
    }
    vec3 boltCol = vec3(0.90, 0.95, 1.0);

    float rainAlpha = clamp(darken + brighten + h * 0.025, 0.0, 0.50);
    float sprayAlpha = clamp(spray * 0.22, 0.0, 0.20);
    float flashAlpha = flash * 0.07 + boltMask * 0.85;
    float alpha = clamp(wash + rainAlpha + sprayAlpha + flashAlpha, 0.0, 0.62);

    vec3 premul = washCol * wash + col * rainAlpha + sprayCol * sprayAlpha + boltCol * flashAlpha;
    fragColor = vec4(premul, alpha) * qt_Opacity * clamp(strength, 0.0, 1.0);
    fragColor.a += 0.0 * glow;
}
