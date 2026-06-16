<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		Color,
		DirectionalLight,
		Mesh,
		MeshStandardMaterial,
		PerspectiveCamera,
		Scene,
		Vector3,
		WebGLRenderer
	} from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import { disposeDracoLoader, loadDracoGeometry } from './loadGeometry';

	let { planetPath = '/messenger/geometries/planets/present/intro/planet.drc' } = $props();

	let host = $state<HTMLDivElement | null>(null);

	onMount(() => {
		if (!host) return;

		const scene = new Scene();
		scene.background = new Color('#dfe8ec');

		const camera = new PerspectiveCamera(45, 1, 0.1, 500);
		camera.position.set(0, 8, 22);

		const renderer = new WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(host.clientWidth, host.clientHeight);
		host.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.target.set(0, 0, 0);

		scene.add(new AmbientLight(0xffffff, 0.55));
		const sun = new DirectionalLight(0xfff2df, 1.35);
		sun.position.set(12, 18, 8);
		scene.add(sun);

		const resize = () => {
			if (!host) return;
			const { clientWidth, clientHeight } = host;
			camera.aspect = clientWidth / Math.max(clientHeight, 1);
			camera.updateProjectionMatrix();
			renderer.setSize(clientWidth, clientHeight);
		};

		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(host);
		resize();

		let planet: Mesh | null = null;
		let frame = 0;

		loadDracoGeometry(planetPath)
			.then((geometry) => {
				geometry.computeVertexNormals();
				planet = new Mesh(
					geometry,
					new MeshStandardMaterial({
						color: new Color('#6f8f78'),
						roughness: 0.92,
						metalness: 0.02,
						flatShading: true
					})
				);
				geometry.computeBoundingBox();
				const box = geometry.boundingBox;
				if (box) {
					const size = box.getSize(new Vector3());
					const center = box.getCenter(new Vector3());
					const scale = 14 / Math.max(size.x, size.y, size.z);
					planet.scale.setScalar(scale);
					planet.position.sub(center.multiplyScalar(scale));
				}
				scene.add(planet);
			})
			.catch((error) => {
				console.error('Failed to load messenger planet geometry', error);
			});

		const tick = () => {
			frame = requestAnimationFrame(tick);
			controls.update();
			if (planet) planet.rotation.y += 0.0015;
			renderer.render(scene, camera);
		};
		tick();

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			controls.dispose();
			renderer.dispose();
			scene.traverse((object) => {
				if (object instanceof Mesh) {
					object.geometry.dispose();
					if (Array.isArray(object.material)) {
						object.material.forEach((material) => material.dispose());
					} else {
						object.material.dispose();
					}
				}
			});
			host?.removeChild(renderer.domElement);
			disposeDracoLoader();
		};
	});
</script>

<div id="webgl" bind:this={host} class="messenger-canvas" aria-label="Messenger planet preview"></div>

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
</style>
