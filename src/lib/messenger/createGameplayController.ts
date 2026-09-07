import {
	Box3, DoubleSide, Group, Matrix3, Matrix4, Mesh, MeshBasicMaterial,
	Quaternion, Raycaster, RingGeometry, Sphere, Vector2, Vector3,
	type PerspectiveCamera
} from 'three';
import { createPlayer } from './createPlayer';
import { disposeScene } from './disposeScene';
import { findNearbyPortal, portalConfig, type PortalConfig } from './portalConfig';

export type MovementKey = 'up' | 'down' | 'left' | 'right';
export type PortalSnapshot = {
	nearby: PortalConfig | null;
	closest: PortalConfig;
	distance: number;
	/** Screen coordinates for the sign above the closest portal. */
	sign: { x: number; y: number; visible: boolean };
	coordinates: string;
};
export type GameplayController = ReturnType<typeof createGameplayController>;

const keyMap: Record<string, MovementKey> = {
	KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
	KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right'
};

export function createGameplayController(
	planet: Group,
	camera: PerspectiveCamera,
	canvas: HTMLCanvasElement,
	onChange: (snapshot: PortalSnapshot) => void
) {
	planet.updateMatrixWorld(true);
	const terrain = planet.getObjectByName('GameplayTerrain');
	if (!terrain) throw new Error('Gameplay terrain is unavailable.');
	const center = planet.localToWorld(new Vector3());
	const bounds = new Box3().setFromObject(terrain).getBoundingSphere(new Sphere());
	const rayLength = bounds.radius + center.distanceTo(bounds.center) + 2;
	const raycaster = new Raycaster();
	const surfaceNormal = new Vector3();
	const normalMatrix = new Matrix3();
	const root = new Group();
	root.name = 'PortalGameplay';
	const player = createPlayer();
	root.add(player.group);

	// Probe radially toward the original planet origin, after the preview's fit transform.
	function sampleSurface(direction: Vector3) {
		raycaster.set(center.clone().addScaledVector(direction, rayLength), direction.clone().negate());
		const hit = raycaster.intersectObject(terrain!, true)[0];
		if (!hit?.face) return null;
		normalMatrix.getNormalMatrix(hit.object.matrixWorld);
		surfaceNormal.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize();
		return { position: hit.point, slope: surfaceNormal.dot(direction) };
	}

	const portals = portalConfig.map((config) => {
		const direction = new Vector3(...config.direction).normalize();
		if (!direction.lengthSq() || !Number.isFinite(direction.lengthSq()) || config.radius <= 0) {
			throw new Error(`Invalid portal position or radius: ${config.id}`);
		}
		const hit = sampleSurface(direction);
		if (!hit || hit.slope < 0.45) throw new Error(`Portal must be on walkable terrain: ${config.id}`);
		const position = hit.position;
		const marker = new Mesh(
			new RingGeometry(config.radius * 0.8, config.radius * 0.84, 64),
			new MeshBasicMaterial({ color: '#ffd89a', transparent: true, opacity: 0.6, side: DoubleSide, depthWrite: false })
		);
		marker.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), direction);
		marker.position.copy(position).addScaledVector(direction, 0.04);
		root.add(marker);
		return { config, direction, position, marker };
	});
	if (!portals.length) throw new Error('Configure at least one portal.');

	const keys = new Set<MovementKey>();
	const touchKeys = new Set<MovementKey>();
	const direction = portals[0].direction.clone();
	const forward = new Vector3(0, 1, 0).projectOnPlane(direction).normalize();
	if (forward.lengthSq() < 0.01) forward.set(0, 0, -1).projectOnPlane(direction).normalize();
	const right = new Vector3();
	const movement = new Vector3();
	const desiredCamera = new Vector3();
	const lookAt = new Vector3();
	const facing = new Vector3().copy(forward);
	const basis = new Matrix4();
	const rotation = new Quaternion();
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	let destination: Vector3 | null = null;
	let lastReport = -Infinity;
	let previousPortal: string | undefined;
	let walking = false;
	let disposed = false;

	function reset() {
		keys.clear();
		touchKeys.clear();
		destination = null;
		const portal = portals[0];
		// Walk outward from the portal in small steps to guarantee a connected spawn path.
		const north = new Vector3(0, 1, 0).projectOnPlane(portal.direction).normalize();
		if (north.lengthSq() < 0.01) north.set(0, 0, -1).projectOnPlane(portal.direction).normalize();
		const east = new Vector3().crossVectors(north, portal.direction).normalize();
		let spawn = portal.position.clone();
		let bestDistance = 0;
		for (let index = 0; index < 8; index++) {
			const angle = index * Math.PI / 4;
			const tangent = north.clone().multiplyScalar(Math.cos(angle)).addScaledVector(east, Math.sin(angle));
			const current = portal.direction.clone();
			let currentRadius = portal.position.distanceTo(center);
			for (let travelled = 0; travelled < portal.config.radius + 0.4; travelled += 0.025) {
				current.addScaledVector(tangent, 0.025 / currentRadius).normalize();
				const hit = sampleSurface(current);
				if (!hit || hit.slope < 0.45 || Math.abs(hit.position.distanceTo(center) - currentRadius) > 0.09) break;
				currentRadius = hit.position.distanceTo(center);
				const distance = hit.position.distanceTo(portal.position);
				if (distance > bestDistance) { bestDistance = distance; spawn = hit.position; }
			}
			if (bestDistance > portal.config.radius + 0.25) break;
		}
		player.group.position.copy(spawn);
		direction.copy(player.group.position).sub(center).normalize();
		forward.copy(portal.direction).projectOnPlane(direction).normalize();
		if (forward.lengthSq() < 0.01) forward.copy(north);
		facing.copy(forward);
		basis.makeBasis(new Vector3().crossVectors(direction, facing).normalize(), direction, facing);
		player.group.quaternion.setFromRotationMatrix(basis);
		lastReport = -Infinity;
		updateCamera(1, true);
	}

	function updateCamera(delta: number, snap = false) {
		forward.projectOnPlane(direction).normalize();
		right.crossVectors(forward, direction).normalize();
		const aspectScale = camera.aspect < 1 ? 1.4 : 1;
		desiredCamera.copy(player.group.position)
			.addScaledVector(direction, 2.8 * aspectScale)
			.addScaledVector(forward, -3.5 * aspectScale);
		lookAt.copy(player.group.position).addScaledVector(direction, 0.18).addScaledVector(forward, 0.35);
		camera.position.lerp(desiredCamera, snap || reducedMotion.matches ? 1 : 1 - Math.exp(-7 * delta));
		camera.up.copy(direction);
		camera.lookAt(lookAt);
		camera.updateMatrixWorld(true);
	}

	const clearInput = () => { keys.clear(); touchKeys.clear(); destination = null; };
	const isInteractiveTarget = (target: EventTarget | null) => target instanceof Element &&
		Boolean(target.closest('input, textarea, select, button, a, [contenteditable="true"]'));
	const keydown = (event: KeyboardEvent) => {
		if (isInteractiveTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
		const key = keyMap[event.code];
		if (key) { event.preventDefault(); keys.add(key); destination = null; }
	};
	const keyup = (event: KeyboardEvent) => { const key = keyMap[event.code]; if (key) keys.delete(key); };
	const visibilitychange = () => { if (document.hidden) clearInput(); };
	const pointerdown = (event: PointerEvent) => {
		if (event.button !== 0) return;
		canvas.focus({ preventScroll: true });
		const rect = canvas.getBoundingClientRect();
		raycaster.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
		const hit = raycaster.intersectObject(terrain, true)[0];
		if (hit) destination = hit.point.clone().sub(center).normalize();
	};
	canvas.tabIndex = 0;
	canvas.setAttribute('aria-label', '探索星球：使用 WASD 或方向键移动，也可以点击附近地面');
	canvas.addEventListener('pointerdown', pointerdown);
	window.addEventListener('keydown', keydown);
	window.addEventListener('keyup', keyup);
	window.addEventListener('blur', clearInput);
	document.addEventListener('visibilitychange', visibilitychange);
	reset();

	return {
		group: root,
		reset() { reset(); canvas.focus({ preventScroll: true }); },
		canEnter(id: string) { return findNearbyPortal(player.group.position, portals)?.config.id === id; },
		stop: clearInput,
		setMovement(key: MovementKey, pressed: boolean) {
			if (pressed) { touchKeys.add(key); destination = null; } else touchKeys.delete(key);
		},
		update(delta: number, elapsed: number) {
			if (disposed) return;
			const dt = Math.min(delta, 0.05);
			const active = (key: MovementKey) => keys.has(key) || touchKeys.has(key) ? 1 : 0;
			movement.copy(forward).multiplyScalar(active('up') - active('down'))
				.addScaledVector(right, active('right') - active('left'));
			if (destination && !movement.lengthSq()) {
				if (direction.angleTo(destination) * player.group.position.distanceTo(center) < 0.06) destination = null;
				else movement.copy(destination).projectOnPlane(direction);
			}
			walking = false;
			if (movement.lengthSq() > 0.000001) {
				movement.normalize();
				const steps = Math.max(1, Math.ceil(dt * 1.1 / 0.025));
				for (let step = 0; step < steps; step++) {
					const radius = player.group.position.distanceTo(center);
					const next = direction.clone().addScaledVector(movement, dt * 1.1 / steps / radius).normalize();
					const hit = sampleSurface(next);
					// Reject walls, steep slopes and drops; ground clicks do not teleport through them.
					if (!hit || hit.slope < 0.45 || Math.abs(hit.position.distanceTo(center) - radius) > 0.09) {
						destination = null;
						break;
					}
					direction.copy(next);
					player.group.position.copy(hit.position);
					walking = true;
				}
				facing.copy(movement);
			}
			facing.projectOnPlane(direction).normalize();
			basis.makeBasis(new Vector3().crossVectors(direction, facing).normalize(), direction, facing);
			rotation.setFromRotationMatrix(basis);
			player.group.quaternion.slerp(rotation, 1 - Math.exp(-15 * dt));
			player.animate(elapsed, walking, reducedMotion.matches);
			updateCamera(dt);
			const nearby = findNearbyPortal(player.group.position, portals);
			for (const portal of portals) {
				portal.marker.material.opacity = portal === nearby ? 1 : 0.5;
				portal.marker.scale.setScalar(portal === nearby && !reducedMotion.matches ? 1 + Math.sin(elapsed * 3) * 0.04 : 1);
			}
			if (elapsed - lastReport >= 0.08 || previousPortal !== nearby?.config.id) {
				lastReport = elapsed;
				previousPortal = nearby?.config.id;
				const closest = portals.reduce((a, b) => a.position.distanceToSquared(player.group.position) < b.position.distanceToSquared(player.group.position) ? a : b);
				const sign = closest.position.clone().addScaledVector(closest.direction, 0.7).project(camera);
				onChange({
					nearby: nearby?.config ?? null,
					closest: closest.config,
					distance: player.group.position.distanceTo(closest.position),
					sign: { x: (sign.x + 1) * 50, y: (1 - sign.y) * 50, visible: sign.z > -1 && sign.z < 1 && Math.abs(sign.x) < 0.95 && Math.abs(sign.y) < 0.85 && closest.direction.dot(camera.position.clone().sub(center).normalize()) > 0.1 },
					coordinates: direction.toArray().map((n) => n.toFixed(5)).join(', ')
				});
			}
		},
		dispose() {
			disposed = true;
			clearInput();
			canvas.removeEventListener('pointerdown', pointerdown);
			window.removeEventListener('keydown', keydown);
			window.removeEventListener('keyup', keyup);
			window.removeEventListener('blur', clearInput);
			document.removeEventListener('visibilitychange', visibilitychange);
			root.removeFromParent();
			disposeScene(root);
		}
	};
}
