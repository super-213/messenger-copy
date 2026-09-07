import { Mesh, Texture, type Object3D, type Material, type ShaderMaterial } from 'three';

export function disposeScene(root: Object3D) {
	const materials = new Set<Material>();
	const textures = new Set<Texture>();
	root.traverse((object) => {
		if (!(object instanceof Mesh)) return;
		object.geometry.dispose();
		for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
	});
	for (const material of materials) {
		for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
		for (const uniform of Object.values((material as ShaderMaterial).uniforms ?? {})) {
			if (uniform.value instanceof Texture) textures.add(uniform.value);
		}
		material.dispose();
	}
	for (const texture of textures) texture.dispose();
}
