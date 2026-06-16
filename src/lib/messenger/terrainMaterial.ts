import { Color, RepeatWrapping, ShaderMaterial, type Texture, Vector3 } from 'three';
import { terrainFragmentShader, terrainVertexShader } from './shaders/terrainMaterial.glsl';

export function createTerrainMaterial(
	atlas: Texture,
	noiseTerrain: Texture,
	noise: Texture,
	lightPosition = new Vector3(10, 16, 6)
): ShaderMaterial {
	noiseTerrain.wrapS = RepeatWrapping;
	noiseTerrain.wrapT = RepeatWrapping;
	noise.wrapS = RepeatWrapping;
	noise.wrapT = RepeatWrapping;

	return new ShaderMaterial({
		name: 'GameplayTerrain',
		uniforms: {
			tColors: { value: atlas },
			tNoiseTerrain: { value: noiseTerrain },
			tNoise: { value: noise },
			uLightPosition: { value: lightPosition.clone() }
		},
		vertexShader: terrainVertexShader,
		fragmentShader: terrainFragmentShader
	});
}

export function setTerrainLight(material: ShaderMaterial, lightPosition: Vector3): void {
	material.uniforms.uLightPosition.value.copy(lightPosition);
}
