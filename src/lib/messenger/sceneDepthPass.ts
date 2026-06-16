import { DepthFormat, UnsignedShortType, WebGLRenderTarget } from 'three';
import { DepthTexture } from 'three';

export function createSceneDepthTarget(width: number, height: number): WebGLRenderTarget {
	const target = new WebGLRenderTarget(width, height, {
		depthBuffer: true
	});
	target.depthTexture = new DepthTexture(width, height);
	target.depthTexture.format = DepthFormat;
	target.depthTexture.type = UnsignedShortType;
	return target;
}

export function resizeSceneDepthTarget(target: WebGLRenderTarget, width: number, height: number): void {
	target.setSize(width, height);
}
