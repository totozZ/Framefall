#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uTime;
uniform float uStrength;
varying vec2 outTexCoord;

// Lightweight reference shader kept separate so it can be promoted to a Phaser
// post pipeline later. The first vertical slice uses the cheaper DOM overlay.
void main() {
  vec2 uv = outTexCoord;
  vec2 centered = uv * 2.0 - 1.0;
  uv += centered * dot(centered, centered) * 0.018 * uStrength;
  float bend = sin(uv.y * 54.0 + uTime * 3.0) * 0.002 * uStrength;
  float shift = 0.0012 + 0.004 * uStrength;
  float r = texture2D(uMainSampler, uv + vec2(shift + bend, 0.0)).r;
  float g = texture2D(uMainSampler, uv + vec2(bend, 0.0)).g;
  float b = texture2D(uMainSampler, uv - vec2(shift - bend, 0.0)).b;
  float scanline = 1.0 - 0.08 * sin(uv.y * uResolution.y * 3.14159);
  gl_FragColor = vec4(vec3(r, g, b) * scanline, 1.0);
}
