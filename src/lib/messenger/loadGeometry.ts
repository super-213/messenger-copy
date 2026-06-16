import type { BufferGeometry } from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { splitBatchedGeometry } from './splitBatchedGeometry';

let decoder: DRACOLoader | null = null;

function getDecoder(): DRACOLoader {
	if (!decoder) {
		decoder = new DRACOLoader();
		decoder.setDecoderPath('/draco/');
	}
	return decoder;
}

export function loadDracoGeometry(path: string): Promise<BufferGeometry> {
	return getDecoder().loadAsync(path);
}

export function loadBatchedDracoGeometries(path: string): Promise<BufferGeometry[]> {
	return getDecoder().loadAsync(path).then(splitBatchedGeometry);
}

export function disposeDracoLoader(): void {
	decoder?.dispose();
	decoder = null;
}
