import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// These template-generated paths are not found by the original literal-URL crawler.
export const mobileGeometryPaths = [
	'geometries/planets/present/intro/low/planet.drc',
	...['full', 'full-lod-1', 'full-lod-3'].flatMap((name) =>
		Array.from({ length: 10 }, (_, i) => `geometries/planets/present/low/${name}_${i}.drc`)),
	...Array.from({ length: 5 }, (_, i) => `geometries/planets/present/low/tree-leaves_${i}.drc`)
];

export async function assertMobileAssets(assets) {
	const required = [...mobileGeometryPaths];
	async function collectAudio(directory) {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const filename = path.join(directory, entry.name);
			if (entry.isDirectory()) await collectAudio(filename);
			else if (entry.name.endsWith('.ogg')) required.push(path.relative(assets, filename).replace(/\.ogg$/, '.mp3'));
		}
	}
	await collectAudio(path.join(assets, 'audio'));
	const invalid = [];
	for (const relative of required) {
		try {
			const data = await readFile(path.join(assets, relative));
			if (!data.length || (relative.endsWith('.drc') && data.subarray(0, 5).toString() !== 'DRACO')) invalid.push(relative);
		} catch { invalid.push(relative); }
	}
	if (invalid.length) throw new Error(`Missing or invalid iPhone/Safari assets:\n${invalid.join('\n')}`);
	return required.length;
}
