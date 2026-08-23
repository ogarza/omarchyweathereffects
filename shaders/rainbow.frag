#version 440

// Primary and secondary rainbow overlay. Premultiplied, low-alpha.
// Arc is opposite the sun (azimuth / distance). Fades after sunset.

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
    float frequency;
    float quality;
};

vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

// t = 0 red (outer primary), t = 1 violet (inner).
vec3 spectral(float t) {
    t = clamp(t, 0.0, 1.0);
    float h = mix(0.0, 0.75, t);
    float sat = mix(0.95, 0.70, t);
    float val = mix(1.0, 0.86, t);
    return hsv2rgb(vec3(h, sat, val));
}

float gauss(float x, float w) {
    float n = x / max(w, 1e-4);
    return exp(-n * n);
}

void main() {
    vec2 uv = qt_TexCoord0;
    float aspect = resolution.x / max(resolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    float az = clamp(azimuth, 0.0, 2.0);
    float dAmt = clamp(sunDistance, 0.0, 2.0);
    float sc = clamp(scale, 0.0, 4.0);
    float glowAmt = clamp(glow, 0.0, 2.0);
    float dens = clamp(density, 0.0, 2.0);
    float nite = clamp(night, 0.0, 1.0);
    float t = time * 0.22 * max(speed, 0.0);

    float hAmt = clamp(lightning, -2.0, 2.0);
    float sunX = aspect * mix(-0.12, 1.12, az * 0.5);
    float antiY = mix(1.16, 1.68, dAmt * 0.5) - hAmt * 0.64;
    vec2 anti = vec2(aspect - sunX, antiY);

    float rad = length(p - anti);
    float rPri = mix(0.50, 1.02, sc * 0.5);
    float rSec = rPri * (51.0 / 42.0);
    float wPri = mix(0.016, 0.046, sc * 0.35) * mix(0.82, 1.18, dens * 0.5);
    float wSec = wPri * 1.18;

    float uP = (rPri + wPri * 0.95 - rad) / max(wPri * 2.0, 1e-4);
    float envP = gauss(rad - rPri, wPri);
    vec3 colP = spectral(uP) * envP;

    float envS = 0.0;
    vec3 colS = vec3(0.0);
    float superN = 0.0;
    vec3 colSup = vec3(0.0);
    if (quality > 0.5) {
        float uS = (rad - (rSec - wSec * 0.95)) / max(wSec * 2.0, 1e-4);
        envS = gauss(rad - rSec, wSec);
        colS = spectral(uS) * envS * 0.36;
    }
    if (quality > 1.5) {
        float inner = rad - (rPri - wPri * 1.55);
        superN = gauss(inner, wPri * 0.52) * 0.20;
        superN *= 0.5 + 0.5 * sin(inner * 88.0 - t * 0.35);
        if (quality > 2.5)
            superN += gauss(inner - wPri * 0.42, wPri * 0.28) * 0.10;
        superN = max(superN, 0.0);
        colSup = spectral(0.82) * superN;
    }

    vec3 col = colP + colS + colSup;
    float lum = max(max(col.r, col.g), col.b);
    col = lum > 0.0 ? col / lum : col;
    col = mix(col, vec3(1.0), 0.07);

    float horizon = smoothstep(1.0, 0.76, uv.y);
    float zenith = smoothstep(0.0, 0.06, uv.y);
    float above = smoothstep(-0.02, 0.07, anti.y - p.y);
    float side = smoothstep(0.0, 0.10, uv.x) * smoothstep(1.0, 0.90, uv.x);
    float shimmer = 0.93 + 0.07 * sin(t + rad * 5.5 + uv.x * 3.2);
    float dayAmt = 1.0 - smoothstep(0.12, 0.78, nite);

    float alpha = (envP * 0.56 + envS * 0.20 + superN * 0.11) * glowAmt * dens * 0.40;
    alpha *= horizon * zenith * above * side * shimmer * dayAmt;
    alpha = clamp(alpha, 0.0, 0.58);

    fragColor = vec4(col * alpha, alpha) * qt_Opacity * clamp(strength, 0.0, 1.0);
    fragColor.a += 0.0 * (frequency + pixelRatio);
}
