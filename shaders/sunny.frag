#version 440

// Warm sunlight overlay: a high-corner glow, faint shafts, and dust motes.
// Premultiplied transparent overlay: no scene texture. Kept low-alpha.

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

float hash11(float n) {
    return fract(sin(n * 127.1) * 43758.5453);
}

void main() {
    vec2 uv = qt_TexCoord0;
    float aspect = resolution.x / max(resolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    vec2 sun = vec2(aspect * 0.83, -0.12);
    vec2 delta = p - sun;
    float dist = length(delta);
    float angle = atan(delta.y, delta.x);

    float glowAmt = clamp(glow, 0.0, 2.0);
    float t = time * max(speed, 0.0);

    float wash = exp(-dist * 1.1) * 0.28;
    wash += exp(-dist * 2.6) * 0.12;
    float sunGlow = wash * glowAmt;

    float shafts = pow(max(sin(angle * 7.0 + t * 0.05) * 0.5 + 0.5, 0.0), 10.0);
    float shafts2 = pow(max(sin(angle * 5.5 + 0.7 - t * 0.03) * 0.5 + 0.5, 0.0), 14.0);
    float rayFade = mix(0.5, 1.0, exp(-dist * 0.22));
    shafts = shafts * 0.20 * glowAmt * rayFade;
    shafts2 = shafts2 * 0.10 * glowAmt * rayFade;

    float motes = 0.0;
    for (int i = 0; i < 18; i++) {
        float fi = float(i);
        float sx = hash11(fi + 1.7);
        float sy = hash11(fi + 8.3);
        float moteSpeed = 0.006 + sx * 0.012;
        vec2 pos = vec2(
            fract(sx + t * moteSpeed * 0.35) * aspect,
            fract(sy + t * moteSpeed * 0.22 + sx * 0.1)
        );
        float r = (0.0018 + hash11(fi + 3.1) * 0.0032) * max(pixelRatio, 1.0);
        float d = length(p - pos);
        float spark = smoothstep(r * 2.4, 0.0, d);
        spark *= 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (1.3 + sx * 2.0) + fi));
        motes += spark;
    }
    motes *= glowAmt;

    vec3 gold = vec3(1.0, 0.86, 0.55);
    vec3 warm = vec3(1.0, 0.93, 0.78);
    vec3 col = mix(gold, warm, clamp(sunGlow * 1.4, 0.0, 1.0));
    float alpha = sunGlow * 0.22 + shafts + shafts2 + motes * 0.16;
    alpha = clamp(alpha, 0.0, 0.48);

    fragColor = vec4(col * alpha, alpha) * qt_Opacity * clamp(strength, 0.0, 1.0);
    fragColor.a += 0.0 * (density + lightning + scale);
}
