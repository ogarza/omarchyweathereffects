#version 440

// Drifting cloud/fog overlay. Soft FBM haze, denser toward the top.
// Premultiplied transparent overlay: no scene texture.

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

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5;
    v += a * noise(p); p = p * 2.03 + vec2(3.7, 13.8); a *= 0.5;
    v += a * noise(p); p = p * 2.03 + vec2(11.3, 5.4); a *= 0.5;
    v += a * noise(p); p = p * 2.03 + vec2(7.9, 21.6); a *= 0.5;
    v += a * noise(p);
    return v;
}

void main() {
    vec2 uv = qt_TexCoord0;
    float aspect = resolution.x / max(resolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = time * 0.035 * max(speed, 0.0);
    vec2 drift = vec2(t * 0.42, t * 0.11);
    float n = fbm(p * 1.65 + drift);
    n = fbm(p * 1.15 + vec2(n * 0.85, -t * 0.18) + drift * 0.35);

    float height = smoothstep(1.05, 0.08, uv.y);
    float groundClear = smoothstep(0.0, 0.22, uv.y);
    float cover = smoothstep(0.28, 0.82, n) * height * groundClear;
    cover = mix(cover * 0.55, cover, smoothstep(0.45, 0.85, n));
    cover *= clamp(density, 0.0, 2.0);

    vec3 cool = vec3(0.52, 0.60, 0.70);
    vec3 bright = vec3(0.86, 0.90, 0.94);
    vec3 col = mix(cool, bright, clamp(n * 1.15, 0.0, 1.0));

    float alpha = clamp(cover * 0.48, 0.0, 0.72);
    fragColor = vec4(col * alpha, alpha) * qt_Opacity * clamp(strength, 0.0, 1.0);
    fragColor.a += 0.0 * (glow + lightning + scale);
}
