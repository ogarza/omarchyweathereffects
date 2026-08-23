# Third-Party Notices

This project includes or is derived from third-party work. The following
notices apply to the rain-on-glass shader, storm lightning, fire shader,
and related code.

## Raindrops on glass — YeHaike

**Author:** YeHaike  
**Title:** Raindrops on glass  
**ShaderToy:** https://www.shadertoy.com/view/DdKyR1

The rain-on-glass shader in this project is substantially modified from
and inspired by YeHaike's "Raindrops on glass" work.

The original source identifies the work as:

> Copyright YeHaike All Rights Reserved
> (841660657@qq.com, NonCommercial, No Copy, No Modify)

The original work is therefore not distributed under this project's MIT
license. This project does not grant additional rights to the original
YeHaike material.

The current implementation contains substantial modifications and
original code, including the rendering and lighting model, analytical
normal-based shading, Qt/OpenGL integration, Hyprland screen-shader
refraction in `HyprShader.js`, parameterization, randomization/noise,
scaling, compositing, and other implementation changes.

For permission or licensing questions concerning the original YeHaike
work, contact the original author at the address provided in the original
source.

## Heartfelt — Martijn Steinrucken (aka BigWings)

**Author:** Martijn Steinrucken aka BigWings  
**Title:** Heartfelt  
**Year:** 2017  
**ShaderToy:** https://www.shadertoy.com/view/ltffzl

The original Heartfelt work is licensed under the:

**Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported
License (CC BY-NC-SA 3.0).**

License:
https://creativecommons.org/licenses/by-nc-sa/3.0/

The rain-on-glass implementation in this project references and is
inspired by the techniques and structure of the above work and has been
substantially modified.

## 301's Fire Shader - Remix 2 — CaliCoastReplay

**Author:** CaliCoastReplay  
**Title:** 301's Fire Shader - Remix 2  
**ShaderToy:** https://www.shadertoy.com/view/MtcGD7 

This implementation is substantially modified from and based on the
above ShaderToy work.

The original ShaderToy source did not include an explicit license or
permission notice. Accordingly, the original work is not assumed to be
licensed under the MIT license used by this repository.

Unlincensed work in ShaderToy is protected by the default under the:

**Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported
License (CC BY-NC-SA 3.0).**

License:
https://creativecommons.org/licenses/by-nc-sa/3.0/

Copyright in the original work remains with its respective author.
This repository does not grant additional rights to the original work.

The current implementation contains substantial modifications and
original code. However, redistribution and licensing of material
derived from the original work remain subject to the rights of the
original author.

For permission to use, modify, or redistribute the original work,
please contact the original author.

## Lightning Strike — Pavlo Zhukov

**Author:** Pavlo Zhukov  
**Title:** Lightning Strike  
**Year:** 2026

The branched lightning in `shaders/stormy.frag` is adapted from this
work. Hash functions are credited to Dave Hoskins (or Inigo Quilez);
fBm follows standard value noise.

The original work is licensed under the:

**Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported
License (CC BY-NC-SA 3.0).**

License:
https://creativecommons.org/licenses/by-nc-sa/3.0/

The original work is therefore not distributed under this project's MIT
license. This project does not grant additional rights to the original
material. ShareAlike terms continue to apply to the adapted lightning
code.

The current implementation contains modifications for Qt overlay
compositing, storm timing, and parameterization, and is combined with
the rain-on-glass overlay in the same shader.

## Licensing of this repository

The MIT license applicable to this repository does not supersede,
replace, or grant additional rights to third-party material identified
above.

Third-party material remains subject to its respective copyright and
license terms. Where third-party terms are more restrictive than the
MIT license, those terms continue to apply to the corresponding
third-party material.

Copyright and licensing information for third-party material should be
preserved when copying, modifying, or redistributing affected code.
