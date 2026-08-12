#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform vec2 uTexel;
varying vec2 outTexCoord;

void main() {
  vec4 base = texture2D(uMainSampler, outTexCoord);
  vec3 glow = texture2D(uMainSampler, outTexCoord + vec2(uTexel.x, 0.0)).rgb;
  glow += texture2D(uMainSampler, outTexCoord - vec2(uTexel.x, 0.0)).rgb;
  glow += texture2D(uMainSampler, outTexCoord + vec2(0.0, uTexel.y)).rgb;
  glow += texture2D(uMainSampler, outTexCoord - vec2(0.0, uTexel.y)).rgb;
  gl_FragColor = vec4(base.rgb + glow * 0.08, base.a);
}
