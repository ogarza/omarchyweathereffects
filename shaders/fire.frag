#version 440

// Ground-fire overlay
//
// Adapted from and substantially modified from a ShaderToy shader by
// an author who has not provided an explicit license in the original
// source.
//
// Original shader:
//   ShaderToy: https://www.shadertoy.com/view/MtcGD7
//   Author: CaliCoastReplay
//
// The original source did not include an explicit copyright license or
// permission notice. The original work is therefore not assumed to be
// licensed under the MIT license used by this repository.
//
// This implementation contains substantial modifications and original
// code, including the Qt/OpenGL integration, configurable parameters,
// transparency/compositing, ground-fire masking, scaling, density and
// speed controls, glow controls, and other rendering changes.
//
// Copyright and licensing rights in the original work remain with the
// original author. This notice does not grant additional rights to the
// original work.
//
// See THIRD_PARTY_NOTICES.md in the repository for additional
// attribution and licensing information.

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

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float rand(vec2 n) {
    return fract(sin(cos(dot(n, vec2(12.9898, 12.1414)))) * 83758.5453);
}

float noise(vec2 n) {
    const vec2 d = vec2(0.0, 1.0);
    vec2 b = floor(n);
    vec2 f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
    return mix(mix(rand(b), rand(b + d.yx), f.x), mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
}

float fbm(vec2 n) {
    float total = 0.0;
    float amplitude = 1.0;
    int octaves = quality < 0.5 ? 2 : quality < 1.5 ? 3 : quality < 2.5 ? 5 : 6;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves)
            break;
        total += noise(n) * amplitude;
        n += n * 1.7;
        amplitude *= 0.47;
    }
    return total;
}

void main() {
    const vec3 c1 = vec3(0.5, 0.0, 0.1);
    const vec3 c2 = vec3(0.9, 0.1, 0.0);
    const vec3 c3 = vec3(0.2, 0.1, 0.7);
    const vec3 c4 = vec3(1.0, 0.9, 0.1);
    const vec3 c5 = vec3(0.1);
    const vec3 c6 = vec3(0.9);

    float t = time * max(speed, 0.0);
    float sizeMul = max(scale, 0.05);
    float dens = clamp(density, 0.0, 2.0);

    // Shadertoy-style Y-up pixel coords.
    vec2 frag = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * resolution;

    vec2 fireSpeed = vec2(1.2, 0.1);
    float shift = 1.327 + sin(t * 2.0) / 2.4;

    // Larger scale → larger flame features (less UV zoom).
    float dist = (3.5 - sin(t * 0.4) / 1.89) / sizeMul;

    vec2 p = frag.xy * dist / max(resolution.x, 1.0);
    p.x -= t / 1.1;
    float q = fbm(p - t * 0.01 + 1.0 * sin(t) / 10.0);
    float qb = quality < 0.5 ? q : fbm(p - t * 0.002 + 0.1 * cos(t) / 5.0);
    float q2 = quality < 1.5 ? 0.0 : fbm(p - t * 0.44 - 5.0 * cos(t) / 7.0) - 6.0;
    float q3 = quality < 1.5 ? 0.0 : fbm(p - t * 0.9 - 10.0 * cos(t) / 30.0) - 4.0;
    float q4 = quality < 1.5 ? 0.0 : fbm(p - t * 2.0 - 20.0 * sin(t) / 20.0) + 2.0;
    if (quality < 0.5)
        q = (q + qb) * 0.5;
    else if (quality < 1.5)
        q = (q + qb - 0.4 * q2) / 2.4;
    else
        q = (q + qb - 0.4 * q2 - 2.0 * q3 + 0.6 * q4) / 3.8;
    vec2 r = vec2(
        fbm(p + q / 2.0 + t * fireSpeed.x - p.x - p.y),
        fbm(p + q - t * fireSpeed.y)
    );
    vec3 c = mix(c1, c2, fbm(p + r)) + mix(c3, c4, r.x) - mix(c5, c6, r.y);
    vec3 color = vec3(c * cos(shift * frag.y / max(resolution.y, 1.0)));
    color += 0.05;
    color.r *= 0.8;

    vec3 hsv = rgb2hsv(max(color, vec3(0.0)));
    hsv.y *= hsv.z * 1.1;
    hsv.z *= hsv.y * 1.13;
    hsv.y = (2.2 - hsv.z * 0.9) * 1.20;
    color = hsv2rgb(hsv);
    color = max(color, vec3(0.0));

    // Soft ground-fire falloff so the upper desktop stays readable.
    float height = frag.y / max(resolution.y, 1.0);
    float groundMask = smoothstep(1.05, 0.12, height);
    groundMask = pow(groundMask, mix(1.35, 0.75, clamp(dens * 0.5, 0.0, 1.0)));

    float luma = max(color.r, max(color.g, color.b));
    float glowBoost = mix(1.0, 1.35, clamp(glow, 0.0, 2.0) * 0.5);
    color *= glowBoost;

    float alpha = clamp(luma * groundMask * mix(0.35, 0.85, dens * 0.5), 0.0, 0.78);
    fragColor = vec4(color * alpha, alpha) * qt_Opacity * clamp(strength, 0.0, 1.0);
    fragColor.a += 0.0 * lightning;
}
