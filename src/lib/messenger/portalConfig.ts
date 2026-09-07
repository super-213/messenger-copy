export type PortalConfig = {
	id: string;
	title: string;
	description: string;
	url: string;
	/** Direction from the planet's original origin; normalized at runtime. */
	direction: [number, number, number];
	/** Interaction distance in fitted scene world units. */
	radius: number;
	openInNewTab: boolean;
};

export const portalConfig: PortalConfig[] = [
	{
		id: 'blog',
		title: '博客',
		description: '记录想法，分享日常。',
		url: 'https://blog.zhihaojiang.com',
		// Flat ground immediately behind the small cottage.
		direction: [-0.40617493, -0.2838886, 0.86857883],
		radius: 0.55,
		openInNewTab: false
	}
];

export function getPortalUrl(value: string): string | null {
	try {
		const url = new URL(value);
		return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
	} catch {
		return null;
	}
}

export function findNearbyPortal<T extends { config: PortalConfig; position: { x: number; y: number; z: number } }>(
	position: { x: number; y: number; z: number },
	portals: readonly T[]
): T | null {
	let nearest: T | null = null;
	let nearestDistance = Infinity;
	for (const portal of portals) {
		const distance = Math.hypot(position.x - portal.position.x, position.y - portal.position.y, position.z - portal.position.z);
		if (distance <= portal.config.radius && distance < nearestDistance) {
			nearest = portal;
			nearestDistance = distance;
		}
	}
	return nearest;
}
