import { BufferAttribute, BufferGeometry } from 'three';

type NamedAttributes = BufferGeometry['attributes'] & {
	batchId?: BufferAttribute;
};

/** Split a Draco mesh that carries a `batchId` attribute into per-batch geometries. */
export function splitBatchedGeometry(geometry: BufferGeometry): BufferGeometry[] {
	const attributes = geometry.attributes as NamedAttributes;
	const index = geometry.index;
	const batchId = attributes.batchId;

	if (!batchId || !index) {
		return [geometry];
	}

	const batchIds = new Set<number>();
	const vertexToLocalIndex = new Map<number, Map<number, number>>();
	const indexLists = new Map<number, number[]>();

	for (let i = 0; i < index.count; i++) {
		const vertexIndex = index.getX(i);
		const batch = batchId.getX(vertexIndex);
		batchIds.add(batch);

		if (!vertexToLocalIndex.has(batch)) {
			vertexToLocalIndex.set(batch, new Map());
			indexLists.set(batch, []);
		}

		const localMap = vertexToLocalIndex.get(batch)!;
		const indices = indexLists.get(batch)!;

		if (localMap.has(vertexIndex)) {
			indices.push(localMap.get(vertexIndex)!);
		} else {
			const localIndex = localMap.size;
			localMap.set(vertexIndex, localIndex);
			indices.push(localIndex);
		}
	}

	const geometries: BufferGeometry[] = [];

	for (const batch of Array.from(batchIds).sort((a, b) => a - b)) {
		const geo = new BufferGeometry();
		const localMap = vertexToLocalIndex.get(batch)!;
		const localVertexCount = localMap.size;

		for (const name in attributes) {
			if (name === 'batchId') continue;
			const attr = attributes[name];
			if (!attr) continue;

			const array = new (attr.array.constructor as Float32ArrayConstructor)(
				localVertexCount * attr.itemSize
			);

			localMap.forEach((localIndex, globalIndex) => {
				for (let component = 0; component < attr.itemSize; component++) {
					array[localIndex * attr.itemSize + component] = attr.getComponent(
						globalIndex,
						component
					);
				}
			});

			geo.setAttribute(name, new BufferAttribute(array, attr.itemSize, attr.normalized));
		}

		const indices = indexLists.get(batch)!;
		const IndexArray = indices.length >= 65535 ? Uint32Array : Uint16Array;
		geo.setIndex(new BufferAttribute(new IndexArray(indices), 1));
		geo.userData.batchId = batch;
		geometries.push(geo);
	}

	return geometries;
}
