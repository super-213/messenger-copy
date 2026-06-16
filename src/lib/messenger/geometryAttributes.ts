import { BufferAttribute, BufferGeometry } from 'three';

function ensureFloatAttribute(geometry: BufferGeometry, name: string, value: number): void {
	const existing = geometry.getAttribute(name);
	if (existing) {
		if (existing.array instanceof Float32Array) return;
		const count = geometry.getAttribute('position').count;
		const floats = new Float32Array(count);
		for (let i = 0; i < count; i++) floats[i] = existing.getX(i);
		geometry.setAttribute(name, new BufferAttribute(floats, 1));
		return;
	}
	const count = geometry.getAttribute('position').count;
	geometry.setAttribute(name, new BufferAttribute(new Float32Array(count).fill(value), 1));
}

/** Draco meshes from the reference game expect terrain shader attributes. */
export function ensureTerrainAttributes(geometry: BufferGeometry): void {
	ensureFloatAttribute(geometry, 'surfaceId', 0);
	ensureFloatAttribute(geometry, 'elementId', 0);
}
