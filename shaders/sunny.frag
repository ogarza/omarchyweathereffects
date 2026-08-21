#version 440

// Warm sunlight overlay: a high-corner glow, faint shafts, and dust motes.
// After sunset, `night` blends the same glow to cool moonlight.
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
    float night;
    float azimuth;
    float sunDistance;
};

float hash11(float n) {
    return fract(sin(n * 127.1) * 43758.5453);
}

void main() {
    vec2 uv = qt_TexCoord0;
    float aspect = resolution.x / max(resolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    float az = clamp(azimuth, 0.0, 2.0);
    float dAmt = clamp(sunDistance, 0.0, 2.0);
    float sunX = aspect * mix(-0.35, 2.01, az * 0.5);
    vec2 sun = vec2(sunX, -0.12);
    vec2 delta = p - sun;
    float angle = atan(delta.y, delta.x);

    // Wide depth range so the slider is obvious. 1.0 is the original cone.
    float z = mix(0.06, 7.5, pow(dAmt * 0.5, 0.85));
    float zRef = mix(0.06, 7.5, pow(0.5, 0.85));
    float fall = z / zRef;
    float dist = length(vec3(delta, z));
    float distScreen = length(delta) * fall;

    float glowAmt = clamp(glow, 0.0, 2.0);
    float n = clamp(night, 0.0, 1.0);
    float t = time * max(speed, 0.0);

    float dayWash = exp(-distScreen * 1.1) * 0.28 + exp(-distScreen * 2.6) * 0.12;
    float nightWash = exp(-distScreen * 0.85) * 0.22 + exp(-distScreen * 1.8) * 0.10;
    float sunGlow = mix(dayWash, nightWash, n) * glowAmt;

    float nRays = mix(2.4, 12.0, dAmt * 0.5);
    float sharp = mix(2.2, 26.0, dAmt * 0.5);
    float shafts = pow(max(sin(angle * nRays + t * 0.05) * 0.5 + 0.5, 0.0), sharp);
    float shafts2 = pow(max(sin(angle * (nRays * 0.78) + 0.7 - t * 0.03) * 0.5 + 0.5, 0.0), sharp + 4.0);
    float rayFade = mix(0.35, 1.0, exp(-distScreen * mix(0.08, 0.55, dAmt * 0.5)));
    float rayAmt = mix(1.0, 0.40, n);
    float cone = pow(zRef / max(dist, 0.001), mix(0.15, 1.8, dAmt * 0.5));
    shafts = shafts * mix(0.34, 0.10, dAmt * 0.5) * glowAmt * rayFade * rayAmt * cone;
    shafts2 = shafts2 * mix(0.18, 0.05, dAmt * 0.5) * glowAmt * rayFade * rayAmt * cone;

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
    motes *= glowAmt * mix(1.0, 0.55, n);

    vec3 gold = vec3(1.0, 0.86, 0.55);
    vec3 warm = vec3(1.0, 0.93, 0.78);
    vec3 steel = vec3(0.55, 0.66, 0.92);
    vec3 silver = vec3(0.82, 0.88, 1.0);
    float heat = clamp(sunGlow * 1.4, 0.0, 1.0);
    vec3 col = mix(mix(gold, warm, heat), mix(steel, silver, heat), n);
    float alpha = sunGlow * mix(0.22, 0.18, n) + shafts + shafts2 + motes * mix(0.16, 0.10, n);
    alpha = clamp(alpha, 0.0, mix(0.72, 0.22, dAmt * 0.5) * mix(1.0, 0.72, n));

    fragColor = vec4(col * alpha, alpha) * qt_Opacity * clamp(strength, 0.0, 1.0);
    fragColor.a += 0.0 * (density + lightning + scale + azimuth + sunDistance);
}
