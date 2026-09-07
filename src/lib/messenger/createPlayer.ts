import { BoxGeometry, CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';

/** A small, self-contained courier, independent of the reference game's character rig. */
export function createPlayer() {
	const group = new Group();
	group.name = 'Player';
	const body = new Group();
	const coat = new MeshStandardMaterial({ color: '#ed9455', roughness: 0.9 });
	const cream = new MeshStandardMaterial({ color: '#fff0d0', roughness: 0.9 });
	const dark = new MeshStandardMaterial({ color: '#293d40', roughness: 0.9 });
	const bagMaterial = new MeshStandardMaterial({ color: '#8b533d', roughness: 1 });
	const torso = new Mesh(new CapsuleGeometry(0.085, 0.1, 4, 8), coat);
	torso.position.y = 0.23;
	const head = new Mesh(new SphereGeometry(0.09, 12, 8), cream);
	head.position.y = 0.405;
	const cap = new Mesh(new SphereGeometry(0.097, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), coat);
	cap.position.y = 0.43;
	const brim = new Mesh(new BoxGeometry(0.19, 0.025, 0.15), coat);
	brim.position.set(0, 0.43, 0.045);
	const bag = new Mesh(new BoxGeometry(0.15, 0.16, 0.075), bagMaterial);
	bag.position.set(0, 0.25, -0.09);
	body.add(torso, head, cap, brim, bag);
	for (const x of [-0.034, 0.034]) {
		const eye = new Mesh(new SphereGeometry(0.013, 6, 6), dark);
		eye.position.set(x, 0.405, 0.078);
		body.add(eye);
	}
	const legs = [-1, 1].map((side) => {
		const leg = new Group();
		leg.position.set(side * 0.052, 0.16, 0);
		const mesh = new Mesh(new CapsuleGeometry(0.032, 0.09, 3, 6), dark);
		mesh.position.y = -0.075;
		leg.add(mesh);
		body.add(leg);
		return leg;
	});
	group.add(body);
	return {
		group,
		animate(time: number, moving: boolean, reducedMotion: boolean) {
			const stride = moving ? Math.sin(time * 15) * 0.55 : 0;
			legs[0].rotation.x = stride;
			legs[1].rotation.x = -stride;
			body.position.y = moving && !reducedMotion ? Math.abs(Math.sin(time * 15)) * 0.015 : 0;
		}
	};
}
