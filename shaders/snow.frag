#version 440

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

const int MAX_LAYERS = 108;
const float SPEED = 0.6;

void main() {
    const mat3 p = mat3(
        13.323122, 23.5112, 21.71123,
        21.1212, 28.7312, 11.9312,
        21.8112, 14.7212, 61.3934
    );

    vec2 frag = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * resolution;
    vec2 uv = vec2(1.0, resolution.y / max(resolution.x, 1.0)) * frag / resolution;

    vec3 acc = vec3(0.0);
    float t = time * max(speed, 0.0);
    float dof = 5.0 * sin(t * 0.1);
    float dens = clamp(density, 0.0, 2.0);
    float sizeMul = max(scale, 0.05);

    // density=1 keeps the light-snow look (50 layers, DEPTH 0.5, WIDTH 0.3).
    float layerCount = dens <= 1.0
        ? mix(6.0, 50.0, dens)
        : mix(50.0, 90.0, dens - 1.0);
    float qCap = quality < 0.5 ? 0.35 : quality < 1.5 ? 0.55 : quality < 2.5 ? 1.0 : 1.2;
    layerCount *= qCap;
    float depth = dens <= 1.0
        ? mix(0.85, 0.5, dens)
        : mix(0.5, 0.16, dens - 1.0);
    float width = dens <= 1.0
        ? mix(0.18, 0.3, dens)
        : mix(0.3, 0.7, dens - 1.0);

    for (int i = 0; i < MAX_LAYERS; i++) {
        float fi = float(i);
        if (fi >= layerCount)
            break;
        vec2 q = uv * (1.0 + fi * depth);
        q += vec2(
            q.y * (width * mod(fi * 7.238917, 1.0) - width * 0.5),
            SPEED * t / (1.0 + fi * depth * 0.03)
        );
        vec3 n = vec3(floor(q), 31.189 + fi);
        vec3 m = floor(n) * 0.00001 + fract(n);
        vec3 mp = (31415.9 + m) / fract(p * m);
        vec3 r = fract(mp);
        vec2 s = abs(mod(q, 1.0) - 0.5 + 0.9 * r.xy - 0.45);
        s += 0.01 * abs(2.0 * fract(10.0 * q.yx) - 1.0);
        float d = (0.6 * max(s.x - s.y, s.x + s.y) + max(s.x, s.y) - 0.01) / sizeMul;
        float edge = (0.005 + 0.05 * min(0.5 * abs(fi - 5.0 - dof), 1.0)) * sizeMul;
        acc += vec3(smoothstep(edge, -edge, d) * (r.x / (1.0 + 0.02 * fi * depth)));
    }

    float alpha = clamp(acc.x * mix(0.55, 1.25, clamp(glow, 0.0, 2.0) * 0.5), 0.0, 0.85);
    vec3 col = mix(vec3(0.72, 0.80, 0.90), vec3(0.93, 0.97, 1.0), clamp(glow, 0.0, 2.0) * 0.5);
    fragColor = vec4(col * alpha, alpha) * qt_Opacity * clamp(strength, 0.0, 1.0);
    fragColor.a += 0.0 * lightning;
}
