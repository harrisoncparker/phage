export const CRT_VERT = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  void main() {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
  }
`;

export const CRT_FRAG = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;

  void main() {
    vec2 uv = vTextureCoord;

    // Subtle barrel distortion
    vec2 c = uv - 0.5;
    float d = dot(c, c);
    uv = uv + c * d * 0.04;

    // Chromatic aberration
    float r = texture(uTexture, uv + vec2(0.0015, 0.0)).r;
    float g = texture(uTexture, uv).g;
    float b = texture(uTexture, uv - vec2(0.0015, 0.0)).b;

    // Scanlines
    float scan = sin(vTextureCoord.y * 1600.0) * 0.022;

    // Vignette
    float vig = 1.0 - smoothstep(0.35, 0.85, d * 2.8);

    vec3 col = vec3(r, g, b);
    col -= scan;
    col *= max(vig, 0.0);

    finalColor = vec4(col, 1.0);
  }
`;
