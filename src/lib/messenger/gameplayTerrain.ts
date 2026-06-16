import { Group, Mesh, type ShaderMaterial } from 'three';
import { ensureTerrainAttributes } from './geometryAttributes';
import { gameplayGeometryPaths } from './introAssets';
import { loadBatchedDracoGeometries } from './loadGeometry';

const terrainChunkCount = 10;

export async function createGameplayTerrainGroup(material: ShaderMaterial): Promise<Group> {
	const chunkPaths = Array.from({ length: terrainChunkCount }, (_, index) =>
		gameplayGeometryPaths.terrainChunk(index)
	);

	const chunkBatches = await Promise.all(chunkPaths.map((path) => loadBatchedDracoGeometries(path)));
	const geometries = chunkBatches.flat();

	const terrain = new Group();
	terrain.name = 'GameplayTerrain';

	for (const [index, geometry] of geometries.entries()) {
		ensureTerrainAttributes(geometry);
		geometry.computeVertexNormals();
		const mesh = new Mesh(geometry, material);
		mesh.name = `TerrainBatch${index}`;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		terrain.add(mesh);
	}

	return terrain;
}

export async function createTreeLeavesGroup(material: ShaderMaterial): Promise<Group> {
	const leafPaths = Array.from({ length: 5 }, (_, index) => gameplayGeometryPaths.treeLeavesChunk(index));
	const chunkBatches = await Promise.all(leafPaths.map((path) => loadBatchedDracoGeometries(path)));
	const geometries = chunkBatches.flat();

	const leaves = new Group();
	leaves.name = 'TreeLeaves';

	for (const [index, geometry] of geometries.entries()) {
		geometry.computeVertexNormals();
		const mesh = new Mesh(geometry, material);
		mesh.name = `TreeLeavesBatch${index}`;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		leaves.add(mesh);
	}

	return leaves;
}
