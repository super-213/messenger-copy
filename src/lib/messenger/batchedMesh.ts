import { BatchedMesh, type BufferGeometry, type Material } from 'three';

export function createBatchedMeshFromGeometries(
	geometries: BufferGeometry[],
	material: Material,
	name = 'BatchedMesh'
): BatchedMesh {
	const maxGeometries = geometries.length;
	const maxVertices = geometries.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0);
	const maxIndices = geometries.reduce((sum, geometry) => sum + (geometry.index?.count ?? 0), 0);

	const mesh = new BatchedMesh(maxGeometries, maxVertices, maxIndices, material);
	mesh.name = name;
	mesh.frustumCulled = false;

	for (const geometry of geometries) {
		const geometryId = mesh.addGeometry(geometry);
		mesh.addInstance(geometryId);
	}

	return mesh;
}
