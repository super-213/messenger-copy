import type { Object3D, PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { createPerformanceMonitor } from './performance.js';

const monitor = createPerformanceMonitor();

type Portal = {
	id: string;
	title: string;
	location: string;
	url: string;
	direction: [number, number, number];
	radius: number;
	openInNewTab: boolean;
	description?: string;
	tags?: string[];
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
		!portal.direction.every(Number.isFinite) || Math.hypot(...portal.direction) === 0 || !Number.isFinite(portal.radius) || portal.radius <= 0 ||
		(portal.description !== undefined && typeof portal.description !== 'string') ||
		(portal.tags !== undefined && (!Array.isArray(portal.tags) || !portal.tags.every((tag) => typeof tag === 'string')))) {
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
const actions = document.createElement('div');
actions.className = 'project-entry-actions';
const more = document.createElement('button');
more.type = 'button';
more.className = 'project-more';
more.textContent = '了解更多';
more.setAttribute('aria-controls', 'project-detail');
more.setAttribute('aria-expanded', 'false');
copy.append(caption, title);
actions.append(more, link);
panel.append(copy, actions);

const detail = document.createElement('section');
detail.id = 'project-detail';
detail.setAttribute('aria-labelledby', 'project-detail-title');
detail.setAttribute('aria-describedby', 'project-detail-description');
const nativePopover = typeof detail.showPopover === 'function';
if (nativePopover) {
	detail.popover = 'auto';
	more.setAttribute('popovertarget', detail.id);
}
else detail.hidden = true;
const close = document.createElement('button');
close.type = 'button';
close.className = 'project-detail-close';
close.textContent = '×';
close.setAttribute('aria-label', '关闭建筑详情');
const detailCopy = document.createElement('div');
detailCopy.className = 'project-detail-copy';
const detailCaption = document.createElement('p');
detailCaption.className = 'project-detail-caption';
const detailTitle = document.createElement('h2');
detailTitle.id = 'project-detail-title';
const description = document.createElement('p');
description.id = 'project-detail-description';
const tags = document.createElement('ul');
tags.className = 'project-detail-tags';
tags.setAttribute('aria-label', '项目标签');
const destination = document.createElement('p');
destination.className = 'project-detail-destination';
const detailLink = document.createElement('a');
detailLink.rel = link.rel;
detailLink.className = 'project-detail-link';
detailCopy.append(detailCaption, detailTitle, description, tags, destination, detailLink);
detail.append(close, detailCopy);
// The engine cancels bubbling touchstart events after audio is unlocked. Safari
// then suppresses the native anchor click, even when pointer events are stopped.
for (const element of [panel, detail]) {
	for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'wheel', 'keydown']) {
		element.addEventListener(type, (event) => event.stopPropagation());
	}
	// Release keys already held before focusing the panel, so movement cannot stick.
	element.addEventListener('keyup', (event) => {
		if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.stopPropagation();
	});
}
document.body.append(panel, detail);

const live = document.createElement('p');
live.className = 'project-sr-only';
live.setAttribute('role', 'status');
live.setAttribute('aria-live', 'polite');
document.body.append(live);
// The static homepage does not need client JS to forward the debug query.
const params = new URLSearchParams((window.top ?? window).location.search);
const ownParams = new URLSearchParams(location.search);
const debug = params.has('debug') || ownParams.has('debug');
const showPerformance = debug || params.has('perf') || ownParams.has('perf');
const coordinates = document.createElement('output');
coordinates.className = 'project-coordinates';
coordinates.hidden = !debug;
document.body.append(coordinates);
let active: ResolvedPortal | null = null;
let currentScene: OriginalScene | null = null;
let lastReport = 0;
let frame = 0;
let detailOpen = false;
let detailPortal: string | null = null;
let transition: ViewTransition | undefined;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const performancePanel = document.createElement('aside');
performancePanel.id = 'project-performance';
performancePanel.hidden = !showPerformance;
performancePanel.setAttribute('aria-label', '本地性能测量');
const performanceOutput = document.createElement('output');
const exportButton = document.createElement('button');
exportButton.type = 'button';
exportButton.textContent = '导出测量';
exportButton.addEventListener('click', () => monitor.api.download());
const resetButton = document.createElement('button');
resetButton.type = 'button';
resetButton.textContent = '重新测量';
resetButton.addEventListener('click', () => monitor.api.reset());
performancePanel.append(performanceOutput, resetButton, exportButton);
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'keydown', 'keyup']) {
	performancePanel.addEventListener(type, (event) => event.stopPropagation());
}
document.body.append(performancePanel);
let lastPerformanceReport = 0;

function fillDetail(portal: Portal) {
	detailCaption.textContent = `星球上的一站 · ${portal.location}`;
	detailTitle.textContent = portal.title;
	description.textContent = portal.description || `从${portal.location}出发，访问${portal.title}。`;
	tags.replaceChildren(...(portal.tags ?? []).map((text) => {
		const tag = document.createElement('li');
		tag.textContent = text;
		return tag;
	}));
	tags.hidden = !portal.tags?.length;
	destination.textContent = new URL(portal.url).hostname;
	detailLink.textContent = `访问${portal.title} ↗`;
	detailLink.href = portal.url;
	detailLink.target = navigationTarget(portal);
	detailPortal = portal.id;
}
function updateDetail(portal: Portal) {
	transition?.skipTransition();
	// Only the named text region is captured; the animated WebGL canvas stays live.
	if (detailOpen && !reducedMotion.matches && typeof document.startViewTransition === 'function') {
		transition = document.startViewTransition(() => { if (detailOpen && active?.id === portal.id) fillDetail(portal); });
		void transition.ready.catch(() => {});
		void transition.finished.catch(() => {});
	} else fillDetail(portal);
}
function closeDetail(restoreFocus = false) {
	transition?.skipTransition();
	if (!detailOpen) return;
	detailOpen = false;
	more.setAttribute('aria-expanded', 'false');
	if (nativePopover) detail.hidePopover();
	else detail.hidden = true;
	monitor.mark('detail-close', active?.id ?? null, false);
	if (restoreFocus && !panel.hidden) more.focus({ preventScroll: true });
	else if (detail.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
}
more.addEventListener('click', (event) => {
	event.preventDefault();
	if (detailOpen) { closeDetail(true); return; }
	if (!active || nearby(currentScene)?.id !== active.id) return;
	fillDetail(active);
	detailOpen = true;
	more.setAttribute('aria-expanded', 'true');
	if (nativePopover) detail.showPopover();
	else detail.hidden = false;
	close.focus({ preventScroll: true });
	monitor.mark('detail-open', active.id, true);
});
close.addEventListener('click', () => closeDetail(true));
detail.addEventListener('beforetoggle', (event) => {
	if ((event as ToggleEvent).newState !== 'closed' || !detailOpen) return;
	detailOpen = false;
	more.setAttribute('aria-expanded', 'false');
	monitor.mark('detail-close', active?.id ?? null, false);
});
document.addEventListener('keydown', (event) => {
	if (!detailOpen || event.key !== 'Escape') return;
	event.preventDefault();
	event.stopImmediatePropagation();
	closeDetail(true);
}, true);
// Older browsers get the same explicit close, Escape and outside-tap behavior.
document.addEventListener('pointerdown', (event) => {
	if (!nativePopover && detailOpen && !detail.contains(event.target as Node) && !panel.contains(event.target as Node)) closeDetail();
}, true);

function nearby(scene: OriginalScene | null) {
	if (!scene?.characters?.mesh || scene.characters.mesh.interactingElement) return null;
	const player = scene.characters.mesh._localObject.position;
	return portals.filter((portal) => portal.position && player.distanceTo(portal.position) <= portal.radius)
		.sort((a, b) => player.distanceTo(a.position!) - player.distanceTo(b.position!))[0] ?? null;
}
function navigationTarget(portal: Portal) {
	// The game lives in a same-origin iframe. Read the installed-app signal from
	// its top-level host, including Safari's Home Screen-specific legacy flag.
	const host = window.top ?? window;
	const standalone = host.matchMedia('(display-mode: standalone)').matches ||
		(host.navigator as Navigator & { standalone?: boolean }).standalone === true;
	// Home Screen apps cannot reliably create a new window from this iframe.
	// A native top-level navigation lets the OS handle an out-of-scope website.
	return portal.openInNewTab && !standalone ? '_blank' : '_top';
}
for (const anchor of [link, detailLink]) anchor.addEventListener('click', (event) => {
	// Recheck at click time, including when the player moved since the last displayed frame.
	if (!active || nearby(currentScene)?.id !== active.id || (anchor === detailLink && detailPortal !== active.id)) {
		event.preventDefault();
		return;
	}
	anchor.target = navigationTarget(active);
	monitor.mark('portal-visit', active.id, detailOpen);
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
	monitor.frame(time, runtime?.controller.state ?? 'loading', active?.id ?? null, detailOpen);
	if (showPerformance && time - lastPerformanceReport >= 1000) {
		const report = monitor.api.snapshot();
		performanceOutput.textContent = `${report.mode === 'long-animation-frame' ? 'LoAF 长帧' : '帧间隔估算'} ≥50ms · ${report.count} 次\n最长 ${report.worstMs}ms${report.blockingMs === null ? '' : ` · 阻塞 ${report.blockingMs}ms`}`;
		lastPerformanceReport = time;
	}
	const scene = runtime?.controller.state === 'present' ? runtime.controller.currentScene : null;
	if (!scene?.characters?.mesh || !scene._isUploaded) {
		active = null;
		panel.hidden = true;
		closeDetail();
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
			link.target = navigationTarget(active);
			live.textContent = `已到达${active.location}，可以访问${active.title}。`;
			if (detailOpen) updateDetail(active);
			monitor.mark('portal-enter', active.id, detailOpen);
		} else {
			closeDetail();
			live.textContent = '';
			monitor.mark('portal-leave', null, false);
		}
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
	closeDetail();
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
document.addEventListener('visibilitychange', () => document.hidden ? pauseUpdates() : resumeUpdates());
