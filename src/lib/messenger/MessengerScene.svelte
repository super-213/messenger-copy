<script lang="ts">
	import {
		AmbientLight,
		Color,
		DirectionalLight,
		Group,
		PerspectiveCamera,
		Scene,
		WebGLRenderer
	} from 'three';
	import type { AnimationMixer, BatchedMesh, ShaderMaterial } from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import type { SceneMode } from './introAssets';
	import { setMessengerLight, updateMessengerMaterials, type MessengerMaterialSet } from './materials';
	import type { MessengerComposer } from './postProcessing';
	import { createSceneDepthTarget, resizeSceneDepthTarget } from './sceneDepthPass';
	import { setGameplayWaterDepth, updateGameplayWaterMaterial } from './gameplayWater';
	import { setTerrainLight } from './terrainMaterial';
	import { setTreeLeavesLight, updateTreeLeavesMaterial } from './treeLeaves';
	import { createGameplayController, type GameplayController, type PortalSnapshot } from './createGameplayController';
	import { disposeScene } from './disposeScene';
	import PortalHud from './PortalHud.svelte';

	const scenePresets: Record<
		SceneMode,
		{ background: string; camera: [number, number, number]; minDist: number; maxDist: number; autoRotate: boolean }
	> = {
		intro: { background: '#dfe8ec', camera: [0, 6, 20], minDist: 8, maxDist: 40, autoRotate: true },
		gameplay: { background: '#b8c9cf', camera: [0, 7, 22], minDist: 8, maxDist: 40, autoRotate: false },
		npcs: { background: '#151a22', camera: [0, 4.5, 11], minDist: 5, maxDist: 22, autoRotate: false }
	};

	let { mode = 'intro' }: { mode?: SceneMode } = $props();

	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let gameplay = $state.raw<GameplayController | null>(null);
	let portal = $state.raw<PortalSnapshot | null>(null);

	function mountWebGL(host: HTMLDivElement) {
		const preset = scenePresets[mode];
		const scene = new Scene();
		scene.background = new Color(preset.background);

		const camera = new PerspectiveCamera(42, 1, 0.1, 500);
		camera.position.set(...preset.camera);

		let renderer: WebGLRenderer;
		try {
			renderer = new WebGLRenderer({ antialias: true, alpha: false });
		} catch (error) {
			console.error('WebGL is unavailable', error);
			status = 'error';
			return;
		}
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(host.clientWidth, host.clientHeight);
		renderer.shadowMap.enabled = mode === 'npcs';
		host.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enabled = mode !== 'gameplay';
		controls.enableDamping = true;
		controls.minDistance = preset.minDist;
		controls.maxDistance = preset.maxDist;
		controls.target.set(0, mode === 'npcs' ? 1.2 : 0, 0);

		scene.add(new AmbientLight(0xffffff, mode === 'npcs' ? 0.45 : mode === 'gameplay' ? 2.2 : 0.62));
		const sun = new DirectionalLight(0xfff1dc, mode === 'npcs' ? 1.8 : 1.4);
		sun.position.set(10, 16, 6);
		if (mode === 'npcs') {
			sun.castShadow = true;
			sun.shadow.mapSize.set(1024, 1024);
		}
		scene.add(sun);

		const runtime = {
			composer: null as MessengerComposer | null,
			sceneGroup: null as Group | null,
			materials: null as MessengerMaterialSet | null,
			terrainMaterial: null as ShaderMaterial | null,
			treeLeavesMaterial: null as ShaderMaterial | null,
			propMaterials: [] as ShaderMaterial[],
			gameplayWaterMaterial: null as ShaderMaterial | null,
			gameplayWater: null as BatchedMesh | null,
			npcMixers: [] as AnimationMixer[],
			autoRotate: preset.autoRotate,
			frame: 0,
			lastFrame: performance.now()
		};
		let controller: GameplayController | null = null;

		let sceneDepthTarget = createSceneDepthTarget(host.clientWidth, host.clientHeight);
		const startedAt = performance.now();
		let loadToken = 0;

		const resize = () => {
			const { clientWidth, clientHeight } = host;
			camera.aspect = clientWidth / Math.max(clientHeight, 1);
			camera.updateProjectionMatrix();
			renderer.setSize(clientWidth, clientHeight);
			resizeSceneDepthTarget(sceneDepthTarget, clientWidth, clientHeight);
			runtime.composer?.resize(clientWidth, clientHeight);
			if (runtime.gameplayWaterMaterial) {
				setGameplayWaterDepth(
					runtime.gameplayWaterMaterial,
					sceneDepthTarget.depthTexture,
					clientWidth,
					clientHeight
				);
			}
		};

		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(host);
		resize();

		const loadScene = async () => {
			const token = ++loadToken;
			status = 'loading';
			try {
				if (mode === 'gameplay') {
					const [{ createGameplaySceneGroup }, { createMessengerComposer }] = await Promise.all([
						import('./createGameplayScene'),
						import('./postProcessing')
					]);
					const bundle = await createGameplaySceneGroup(renderer);
					if (token !== loadToken) { disposeScene(bundle.group); bundle.lut.dispose(); return; }
					runtime.sceneGroup = bundle.group;
					runtime.terrainMaterial = bundle.terrainMaterial;
					runtime.treeLeavesMaterial = bundle.treeLeavesMaterial;
					runtime.propMaterials = bundle.propMaterials;
					runtime.gameplayWater = bundle.gameplayWater;
					runtime.gameplayWaterMaterial = bundle.gameplayWaterMaterial;
					setTerrainLight(bundle.terrainMaterial, sun.position);
					setTreeLeavesLight(bundle.treeLeavesMaterial, sun.position);
					setGameplayWaterDepth(
						runtime.gameplayWaterMaterial,
						sceneDepthTarget.depthTexture,
						host.clientWidth,
						host.clientHeight
					);
					scene.add(bundle.group);
					controller = createGameplayController(bundle.group, camera, renderer.domElement, (snapshot) => { portal = snapshot; });
					gameplay = controller;
					scene.add(controller.group);
					runtime.composer = createMessengerComposer(renderer, scene, camera, bundle.lut);
					runtime.composer.resize(host.clientWidth, host.clientHeight);
				} else if (mode === 'npcs') {
					const { createNpcGalleryGroup } = await import('./createNpcGallery');
					const bundle = await createNpcGalleryGroup(renderer);
					if (token !== loadToken) { disposeScene(bundle.group); return; }
					runtime.sceneGroup = bundle.group;
					runtime.npcMixers = bundle.mixers;
					bundle.npcMaterial.uniforms.uLightPosition.value.copy(sun.position);
					scene.add(bundle.group);
				} else {
					const { createIntroSceneGroup } = await import('./createIntroScene');
					const bundle = await createIntroSceneGroup(renderer);
					if (token !== loadToken) { disposeScene(bundle.group); return; }
					runtime.sceneGroup = bundle.group;
					runtime.materials = bundle.materials;
					setMessengerLight(runtime.materials, sun.position);
					scene.add(bundle.group);
				}
				status = 'ready';
			} catch (error) {
				if (token !== loadToken) return;
				console.error('Failed to load messenger scene', error);
				status = 'error';
			}
		};

		void loadScene();

		const tick = () => {
			runtime.frame = requestAnimationFrame(tick);
			const now = performance.now();
			const delta = (now - runtime.lastFrame) / 1000;
			runtime.lastFrame = now;

			if (controls.enabled) controls.update();
			const elapsed = (now - startedAt) / 1000;
			controller?.update(delta, elapsed);
			if (runtime.autoRotate && runtime.sceneGroup) runtime.sceneGroup.rotation.y += 0.0012;
			if (runtime.materials) updateMessengerMaterials(runtime.materials, elapsed);
			if (runtime.treeLeavesMaterial) updateTreeLeavesMaterial(runtime.treeLeavesMaterial, elapsed);
			if (runtime.gameplayWaterMaterial) {
				updateGameplayWaterMaterial(runtime.gameplayWaterMaterial, elapsed);
			}
			for (const material of runtime.propMaterials) {
				material.uniforms.uTime.value = elapsed;
			}
			for (const mixer of runtime.npcMixers) {
				mixer.update(delta);
			}

			if (runtime.composer && runtime.gameplayWater && runtime.gameplayWaterMaterial) {
				runtime.gameplayWater.visible = false;
				renderer.setRenderTarget(sceneDepthTarget);
				renderer.clear();
				renderer.render(scene, camera);
				renderer.setRenderTarget(null);
				runtime.gameplayWater.visible = true;
				setGameplayWaterDepth(
					runtime.gameplayWaterMaterial,
					sceneDepthTarget.depthTexture,
					renderer.domElement.width,
					renderer.domElement.height
				);
				runtime.composer.render();
			} else if (runtime.composer) {
				runtime.composer.render();
			} else {
				renderer.render(scene, camera);
			}
		};
		tick();

		return () => {
			loadToken += 1;
			cancelAnimationFrame(runtime.frame);
			resizeObserver.disconnect();
			controller?.dispose();
			runtime.composer?.dispose();
			disposeScene(scene);
			sceneDepthTarget.dispose();
			controls.dispose();
			renderer.dispose();
			scene.clear();
			host.removeChild(renderer.domElement);
		};
	}
</script>

<div
	id="webgl"
	{@attach mountWebGL}
	class="messenger-canvas"
	aria-label="Messenger scene preview"
>
	{#if status === 'loading'}
		<p class="status" role="status">正在准备星球…</p>
	{:else if status === 'error'}
		<p class="status error" role="alert">场景加载失败，请刷新重试。</p>
	{/if}
</div>

{#if mode === 'gameplay'}
	<PortalHud controller={gameplay} snapshot={portal} {status} />
{/if}

<style>
	.messenger-canvas {
		display: block;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.messenger-canvas :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.status {
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: 1;
		margin: 0;
		transform: translate(-50%, -50%);
		padding: 0.65rem 0.9rem;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.88);
		color: #42515a;
		font-size: 0.9rem;
		pointer-events: none;
	}

	.status.error {
		color: #8a2f2f;
	}
</style>
