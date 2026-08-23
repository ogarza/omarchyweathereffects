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
    float frequency;
    float quality;
};

const float RandomSeed = 4.3315;
const float NumberScaleOfStaticRaindrops = 0.35;
const float NumberScaleOfRollingRaindrops = 0.35;
const float StaticRaindropUVScale = 20.0;
const float RollingRaindropUVScaleLayer01 = 2.25;
const float RollingRaindropUVScaleLayer02 = 2.25;
const float GridWrap = 128.0;

vec2 wrapId(vec2 id) {
    return vec2(mod(id.x, 256.0), mod(id.y, GridWrap));
}

float GradientWave(float b, float t) {
    return smoothstep(0.0, b, t) * smoothstep(1.0, b, t);
}

// Fract hash. sin() hashes fall apart once rolling-cell IDs grow with time.
float Random(vec2 uv, float seed) {
    vec3 p3 = fract(vec3(uv.xyx) * 0.1031 + seed);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 RandomVec3(vec2 uv, float seed) {
    return vec3(Random(uv, seed), Random(uv + vec2(17.13, 9.21), seed), Random(uv + vec2(3.71, 28.44), seed));
}

// Cheap 2D value noise in roughly [-1, 1], used to irregularize drop edges.
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

// YeHaike raindrop-on-glass surface.
// Return: x = height, yz = (dz/dx, dz/dy).
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

// Return: x = height, yz = (dz/dx, dz/dy).
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
    float sizeMul = max(min(scale, 1.0), 0.05);
    float dropSize = 1.65 * (0.2 + distanceScale) * distanceMaxRange * mix(1.5, 0.5, rng.x) * sizeMul;

    vec2 tempXY = vec2(xy.x, xy.y) * (4.0 / sizeMul);
    float randomScale = ProportionalMapToRange(0.85, 1.35, rng.z);
    float yStretch = max(smoothstep(1.0, 0.4, yDistance * rng.z), 0.15);
    tempXY.x = randomScale * mix(tempXY.x, tempXY.x / yStretch, smoothstep(1.0, 0.0, rng.x));
    tempXY += edge;

    vec3 hn = RaindropSurface(tempXY, dropSize, 1.0);
    return hn * visible;
}

// Return: x = height, yz = (dz/dx, dz/dy), w = trail mask.
vec4 RollingRaindrops(vec2 uv, float t, float uvScale) {
    vec2 localUV = uv * uvScale;
    vec2 tempUV = localUV;
    vec2 constantA = vec2(6.0, 1.0);
    vec2 gridNum = constantA * 2.0;
    vec2 gridID = wrapId(floor(localUV * gridNum));

    float randomFloat = Random(vec2(gridID.x * 13.26, gridID.x * 10.81), RandomSeed);
    float timeMovingY = t * 0.85 * ProportionalMapToRange(0.1, 0.25, randomFloat);
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
    float sizeMul = max(min(scale, 1.0), 0.05);
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

vec4 Raindrops(vec2 uv, float t) {
    vec4 roll1 = RollingRaindrops(uv, t, RollingRaindropUVScaleLayer01);
    vec3 stat = quality < 0.5 ? vec3(0.0) : StaticRaindrops(uv, t, StaticRaindropUVScale);
    vec4 roll2 = quality < 1.5 ? vec4(0.0) : RollingRaindrops(uv * 1.7, t, RollingRaindropUVScaleLayer02);
    vec4 roll3 = quality < 2.5 ? vec4(0.0) : RollingRaindrops(uv * 2.35, t, RollingRaindropUVScaleLayer02 * 1.15);

    float height = stat.x + roll1.x + roll2.x + roll3.x;
    vec2 deriv = stat.yz + roll1.yz + roll2.yz + roll3.yz;
    float trail = max(max(roll1.w, roll2.w), roll3.w);
    return vec4(height, deriv, trail);
}

void main() {
    float dpr = max(pixelRatio, 1.0);
    float unit = 1080.0 * dpr;

    vec2 frag = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * resolution;
    vec2 uv = (frag - 0.5 * resolution) / unit;

    vec4 rain = Raindrops(uv, time * max(speed, 0.0));
    float h = rain.x;
    vec2 deriv = rain.yz;
    float trail = rain.w;

    float cover = max(smoothstep(0.0, max(fwidth(h) * 2.35, 0.011), h),
                      smoothstep(0.0, max(fwidth(trail) * 2.1, 0.035), trail));
    if (cover < 0.02) {
        fragColor = vec4(0.0);
        return;
    }

    // Geometric normal of z = H(x, y). Keep slope modest so rims stay thin.
    vec2 slope = deriv * 0.85;
    vec3 N = normalize(vec3(-slope, 1.0));
    vec3 L = normalize(vec3(-0.34, 0.58, 0.74));
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 Hv = normalize(L + V);

    float ndotl = max(dot(N, L), 0.0);
    float specBroad = pow(max(dot(N, Hv), 0.0), 28.0);
    float spec = quality < 1.5 ? 0.0 : pow(max(dot(N, Hv), 0.0), quality > 2.5 ? 140.0 : 96.0);
    float fresnel = quality < 0.5 ? 0.0 : pow(clamp(1.0 - max(N.z, 0.0), 0.0, 1.0), 6.5);
    float steep = length(slope);

    // Hairline meniscus: only the steepest contact ring.
    float meniscus = 0.0;
    if (quality > 1.5)
        meniscus = pow(smoothstep(0.28, 0.82, steep), 2.6) * smoothstep(0.0, 0.02, h)
            * (1.0 - smoothstep(0.05, 0.16, h));
    float body = smoothstep(0.0, 0.22, h);
    float trailFilm = smoothstep(0.02, 0.45, trail) * (1.0 - smoothstep(0.15, 0.55, h));

    // Premultiplied overlay: low rgb + alpha darkens (lens), high rgb glints.
    float sheen = clamp(glow, 0.0, 2.0);
    float darken = body * mix(0.12, 0.04, ndotl) + trailFilm * 0.04;
    float brighten = (meniscus * 0.22 + fresnel * 0.08 + spec * 0.70 + specBroad * 0.06) * sheen;
    float alpha = clamp(darken + brighten + h * 0.025, 0.0, 0.50);

    vec3 glass = vec3(0.78, 0.91, 1.0);
    vec3 col = glass * (meniscus * 0.70 + fresnel * 0.22 + spec * 1.35 + specBroad * 0.12) * mix(0.55, 1.15, sheen * 0.5);
    col *= mix(0.70, 1.0, ndotl * 0.55 + 0.45);

    fragColor = vec4(col * alpha, alpha) * cover * qt_Opacity * clamp(strength, 0.0, 1.0);
    fragColor.a += 0.0 * lightning;
}
