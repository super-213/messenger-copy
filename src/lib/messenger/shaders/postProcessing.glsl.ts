export const postVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export const postFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tLUT;
uniform vec2 uResolution;
uniform float uLUTIntensity;
uniform float uOutlineStrength;
uniform vec3 uOutlineColor;
uniform float uCameraNear;
uniform float uCameraFar;

varying vec2 vUv;

float linearizeDepth(float depth) {
	float z = depth * 2.0 - 1.0;
	return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
}

float readDepth(vec2 uv) {
	return linearizeDepth(texture2D(tDepth, uv).x);
}

vec3 applyStripLUT(vec3 color, sampler2D lut, float intensity) {
	float size = 8.0;
	float slice = color.b * (size - 1.0);
	float slice0 = floor(slice);
	float slice1 = min(slice0 + 1.0, size - 1.0);
	float blend = slice - slice0;
	vec2 uv0 = vec2((color.r * (size - 1.0) + slice0 + 0.5) / (size * size), (color.g * (size - 1.0) + 0.5) / size);
	vec2 uv1 = vec2((color.r * (size - 1.0) + slice1 + 0.5) / (size * size), (color.g * (size - 1.0) + 0.5) / size);
	vec3 graded = mix(texture2D(lut, uv0).rgb, texture2D(lut, uv1).rgb, blend);
	return mix(color, graded, intensity);
}

void main() {
	vec2 texel = 1.0 / uResolution;
	vec3 sceneColor = texture2D(tDiffuse, vUv).rgb;

	float center = readDepth(vUv);
	float edge = 0.0;
	edge += abs(center - readDepth(vUv + vec2(texel.x, 0.0)));
	edge += abs(center - readDepth(vUv + vec2(0.0, texel.y)));
	edge += abs(center - readDepth(vUv + vec2(texel.x, texel.y)));
	edge = smoothstep(0.02, 0.18, edge);

	sceneColor = applyStripLUT(sceneColor, tLUT, uLUTIntensity);
	sceneColor = mix(sceneColor, uOutlineColor, edge * uOutlineStrength);

	gl_FragColor = vec4(sceneColor, 1.0);
}
`;
