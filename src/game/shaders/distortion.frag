#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uStrength;
varying vec2 outTexCoord;

void main() {
  vec2 uv = outTexCoord;
  float tear = step(0.91, fract(uv.y * 7.0 + uTime * 0.7));
  uv.x += sin(uv.y * 78.0 + uTime * 11.0) * 0.006 * uStrength;
  uv.x += tear * sin(uTime * 21.0) * 0.045 * uStrength;
  gl_FragColor = texture2D(uMainSampler, uv);
}
