import {
	Color,
	DoubleSide,
	Group,
	Mesh,
	ShaderMaterial,
	type Texture,
	type WebGLRenderer
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { Camera, PerspectiveCamera, Scene } from 'three';
import { createPostMaterial } from './postMaterial';

export type MessengerComposer = {
	composer: EffectComposer;
	postPass: ShaderPass;
	resize: (width: number, height: number) => void;
	render: () => void;
	dispose: () => void;
};

export function createMessengerComposer(
	renderer: WebGLRenderer,
	scene: Scene,
	camera: Camera,
	lut: Texture
): MessengerComposer {
	const composer = new EffectComposer(renderer);
	const renderPass = new RenderPass(scene, camera);
	const postMaterial = createPostMaterial(lut);
	const postPass = new ShaderPass(postMaterial);

	composer.addPass(renderPass);
	composer.addPass(postPass);

	const resize = (width: number, height: number) => {
		composer.setSize(width, height);
		postMaterial.uniforms.uResolution.value.set(width, height);
	};

	const perspectiveCamera = camera as PerspectiveCamera;
	postMaterial.uniforms.uCameraNear.value = perspectiveCamera.near;
	postMaterial.uniforms.uCameraFar.value = perspectiveCamera.far;

	const originalRender = postPass.render.bind(postPass);
	postPass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
		postMaterial.uniforms.tDepth.value = readBuffer.depthTexture;
		originalRender(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
	};

	return {
		composer,
		postPass,
		resize,
		render: () => composer.render(),
		dispose: () => {
			composer.dispose();
			postMaterial.dispose();
		}
	};
}

export function createPropMaterial(color: string, noise?: Texture): ShaderMaterial {
	return new ShaderMaterial({
		transparent: true,
		side: DoubleSide,
		depthWrite: true,
		uniforms: {
			uColor: { value: new Color(color) },
			tNoise: { value: noise ?? null },
			uTime: { value: 0 },
			uUseNoise: { value: noise ? 1 : 0 }
		},
		vertexShader: /* glsl */ `
			varying vec3 vWorldPosition;
			uniform float uTime;
			uniform float uUseNoise;
			uniform sampler2D tNoise;
			void main() {
				vec3 pos = position;
				if (uUseNoise > 0.5) {
					float n = texture2D(tNoise, pos.xz * 0.05 + uTime * 0.02).r;
					pos += normal * n * 0.04;
				}
				vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
				vWorldPosition = worldPosition.xyz;
				gl_Position = projectionMatrix * viewMatrix * worldPosition;
			}
		`,
		fragmentShader: /* glsl */ `
			uniform vec3 uColor;
			varying vec3 vWorldPosition;
			void main() {
				gl_FragColor = vec4(uColor, 0.9);
			}
		`
	});
}

export function attachGameplayProps(
	root: Group,
	props: Array<{ name: string; mesh: Mesh }>
): void {
	const propsGroup = new Group();
	propsGroup.name = 'GameplayProps';
	for (const prop of props) {
		prop.mesh.name = prop.name;
		propsGroup.add(prop.mesh);
	}
	root.add(propsGroup);
}
