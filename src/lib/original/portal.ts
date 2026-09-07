import type { Object3D, PerspectiveCamera, Raycaster, Vector3 } from 'three';

type Portal = {
	id: string;
	title: string;
	location: string;
	url: string;
	direction: [number, number, number];
	radius: number;
	openInNewTab: boolean;
};
type ResolvedPortal = Portal & { position: Vector3 | null; marker: HTMLSpanElement | null };
type OriginalScene = {
	_isUploaded: boolean;
	camera: PerspectiveCamera;
	characters: { mesh: {
		interactingElement: unknown;
		_localObject: { position: Vector3 };
		_collisionPhysics: { _rayCaster: Raycaster; _collider: Object3D };
	} };
};
type OriginalWindow = Window & {
	__originalMessenger?: { controller: { state: string; currentScene: OriginalScene } };
};

// Runs inside the original, same-origin game document. It never modifies the renderer or movement.
const configured: Portal[] = await fetch(new URL('./portals.json', import.meta.url)).then((response) => {
	if (!response.ok) throw new Error('Project entry configuration could not be loaded.');
	return response.json();
});
const portals: ResolvedPortal[] = configured.map((portal) => {
	const url = new URL(portal.url);
	if (!['https:', 'http:'].includes(url.protocol) || !Array.isArray(portal.direction) || portal.direction.length !== 3 ||
		!portal.direction.every(Number.isFinite) || Math.hypot(...portal.direction) === 0 || !Number.isFinite(portal.radius) || portal.radius <= 0) {
		throw new Error(`Invalid project entry: ${portal.id}`);
	}
	return { ...portal, url: url.href, position: null, marker: null };
});

const panel = document.createElement('aside');
panel.id = 'project-entry';
panel.hidden = true;
panel.setAttribute('aria-label', '项目入口');
const copy = document.createElement('div');
const caption = document.createElement('p');
const title = document.createElement('strong');
const link = document.createElement('a');
link.rel = 'external noopener noreferrer';
copy.append(caption, title);
panel.append(copy, link);
panel.addEventListener('pointerdown', (event) => event.stopPropagation());
panel.addEventListener('pointerup', (event) => event.stopPropagation());
panel.addEventListener('click', (event) => event.stopPropagation());
document.body.append(panel);

const live = document.createElement('p');
live.className = 'project-sr-only';
live.setAttribute('role', 'status');
live.setAttribute('aria-live', 'polite');
document.body.append(live);
const debug = new URLSearchParams(location.search).has('debug');
const coordinates = document.createElement('output');
coordinates.className = 'project-coordinates';
coordinates.hidden = !debug;
document.body.append(coordinates);
let active: ResolvedPortal | null = null;
let currentScene: OriginalScene | null = null;
let lastReport = 0;
let frame = 0;

function nearby(scene: OriginalScene | null) {
	if (!scene?.characters?.mesh || scene.characters.mesh.interactingElement) return null;
	const player = scene.characters.mesh._localObject.position;
	return portals.filter((portal) => portal.position && player.distanceTo(portal.position) <= portal.radius)
		.sort((a, b) => player.distanceTo(a.position!) - player.distanceTo(b.position!))[0] ?? null;
}
link.addEventListener('click', (event) => {
	// Recheck at click time, including when the player moved since the last displayed frame.
	if (!active || nearby(currentScene)?.id !== active.id) event.preventDefault();
});

function initialize(scene: OriginalScene) {
	const mesh = scene.characters.mesh;
	const ray = mesh._collisionPhysics._rayCaster;
	for (const portal of portals) {
		portal.marker?.remove();
		portal.marker = null;
		portal.position = null;
		const direction = mesh._localObject.position.clone().set(...portal.direction).normalize();
		ray.set(direction.clone().multiplyScalar(100), direction.clone().negate());
		const hit = ray.intersectObject(mesh._collisionPhysics._collider)[0];
		if (!hit) { console.warn(`Project entry has no ground: ${portal.id}`); continue; }
		portal.position = hit.point.clone();
		const marker = document.createElement('span');
		marker.className = 'project-marker';
		marker.textContent = `${portal.title} · ${portal.location}`;
		marker.hidden = true;
		document.body.append(marker);
		portal.marker = marker;
	}
}

function tick(time: number) {
	frame = requestAnimationFrame(tick);
	const runtime = (window as OriginalWindow).__originalMessenger;
	const scene = runtime?.controller.state === 'present' ? runtime.controller.currentScene : null;
	if (!scene?.characters?.mesh || !scene._isUploaded) {
		active = null;
		panel.hidden = true;
		live.textContent = '';
		for (const portal of portals) if (portal.marker) portal.marker.hidden = true;
		return;
	}
	if (currentScene !== scene) { currentScene = scene; initialize(scene); }
	const next = nearby(scene);
	if (next !== active) {
		active = next;
		panel.hidden = !active;
		if (active) {
			caption.textContent = `已到达 · ${active.location}`;
			title.textContent = active.title;
			link.textContent = `访问${active.title} ↗`;
			link.href = active.url;
			link.target = active.openInNewTab ? '_blank' : '_top';
			live.textContent = `已到达${active.location}，可以访问${active.title}。`;
		} else live.textContent = '';
	}
	const player = scene.characters.mesh._localObject.position;
	const camera = scene.camera;
	for (const portal of portals) {
		if (!portal.marker || !portal.position) continue;
		const distance = player.distanceTo(portal.position);
		const point = portal.position.clone().addScaledVector(portal.position.clone().normalize(), 2.4).project(camera);
		const facing = portal.position.clone().normalize().dot(camera.position.clone().normalize()) > 0.1;
		portal.marker.hidden = Boolean(scene.characters.mesh.interactingElement) || distance > 18 || !facing || point.z < -1 || point.z > 1 || Math.abs(point.x) > 0.9 || Math.abs(point.y) > 0.85;
		portal.marker.style.left = `${(point.x + 1) * 50}%`;
		portal.marker.style.top = `${(1 - point.y) * 50}%`;
		portal.marker.classList.toggle('active', active === portal);
	}
	if (debug && time - lastReport > 200) {
		lastReport = time;
		coordinates.textContent = `direction: [${player.clone().normalize().toArray().map((n) => n.toFixed(5)).join(', ')}]`;
	}
}
function pauseUpdates() {
	cancelAnimationFrame(frame);
	active = null;
	panel.hidden = true;
	live.textContent = '';
	for (const portal of portals) if (portal.marker) portal.marker.hidden = true;
}
function resumeUpdates() {
	// Back/forward cache restores this document without running the module again.
	// Cancel any pending frame so repeated pageshow events cannot create duplicate loops.
	cancelAnimationFrame(frame);
	frame = requestAnimationFrame(tick);
}
resumeUpdates();
window.addEventListener('pagehide', pauseUpdates);
window.addEventListener('pageshow', resumeUpdates);
