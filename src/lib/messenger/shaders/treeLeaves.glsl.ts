export const treeLeavesVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vRand;

uniform float uTime;
uniform float uScale;

void main() {
	vUv = uv;
	vRand = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
	vNormal = normalize(normalMatrix * normal);

	vec3 pos = position;
	float sway = sin(uTime * 0.75 + pos.x * 3.0 + pos.z * 2.0) * 0.04 * vRand;
	pos.x += sway;
	pos.z += sway * 0.5;

	vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
	vWorldPosition = worldPosition.xyz;
	gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const treeLeavesFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D tTrees;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uLightPosition;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vRand;

void main() {
	vec4 leaf = texture2D(tTrees, vUv);
	if (leaf.a < 0.35) discard;

	vec3 tint = mix(uColor1, uColor2, vRand);
	tint = mix(tint, uColor3, step(0.6, vRand));
	vec3 color = mix(tint, leaf.rgb, 0.65);

	vec3 lightDir = normalize(uLightPosition - vWorldPosition);
	float shade = max(dot(normalize(vNormal), lightDir), 0.0);
	color *= 0.55 + shade * 0.45;

	gl_FragColor = vec4(color, leaf.a);
}
`;
