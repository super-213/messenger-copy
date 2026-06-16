import type { Texture, WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

let loader: KTX2Loader | null = null;
let activeRenderer: WebGLRenderer | null = null;

export function initKtx2Loader(renderer: WebGLRenderer): KTX2Loader {
	if (!loader || activeRenderer !== renderer) {
		loader?.dispose();
		loader = new KTX2Loader()
			.setTranscoderPath('/messenger/libs/basis/')
			.detectSupport(renderer);
		activeRenderer = renderer;
	}
	return loader;
}

export function loadKtx2Texture(path: string): Promise<Texture> {
	if (!loader) {
		throw new Error('KTX2 loader not initialized. Call initKtx2Loader(renderer) first.');
	}
	return loader.loadAsync(path);
}

export function disposeKtx2Loader(): void {
	loader?.dispose();
	loader = null;
	activeRenderer = null;
}
