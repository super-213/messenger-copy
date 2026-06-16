import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { BufferGeometry } from 'three';

const decoder = new DRACOLoader();
decoder.setDecoderPath('/draco/');

export function loadDracoGeometry(path: string): Promise<BufferGeometry> {
	return decoder.loadAsync(path);
}

export function disposeDracoLoader(): void {
	decoder.dispose();
}
