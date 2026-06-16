import { Color, ShaderMaterial, type Texture, Vector2 } from 'three';
import { postFragmentShader, postVertexShader } from './shaders/postProcessing.glsl';

export function createPostMaterial(lut: Texture): ShaderMaterial {
	return new ShaderMaterial({
		uniforms: {
			tDiffuse: { value: null },
			tDepth: { value: null },
			tLUT: { value: lut },
			uResolution: { value: new Vector2(1, 1) },
			uLUTIntensity: { value: 0.3 },
			uOutlineStrength: { value: 0.35 },
			uOutlineColor: { value: new Color('#373f42') },
			uCameraNear: { value: 0.1 },
			uCameraFar: { value: 500 }
		},
		vertexShader: postVertexShader,
		fragmentShader: postFragmentShader
	});
}
