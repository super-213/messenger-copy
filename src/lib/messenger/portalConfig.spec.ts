import { describe, expect, it } from 'vitest';
import { findNearbyPortal, getPortalUrl, portalConfig } from './portalConfig';

describe('portal proximity', () => {
	const portal = { config: { ...portalConfig[0], radius: 1 }, position: { x: 0, y: 0, z: 0 } };
	it('only activates within the full 3D interaction radius, including its edge', () => {
		expect(findNearbyPortal({ x: 0, y: 0, z: 1 }, [portal])).toBe(portal);
		expect(findNearbyPortal({ x: 0, y: 0, z: 1.001 }, [portal])).toBeNull();
		expect(findNearbyPortal({ x: 0, y: 2, z: 0 }, [portal])).toBeNull();
	});
	it('selects the closest portal when areas overlap', () => {
		const other = { config: { ...portal.config, id: 'other' }, position: { x: 0.7, y: 0, z: 0 } };
		expect(findNearbyPortal({ x: 0.6, y: 0, z: 0 }, [portal, other])).toBe(other);
		expect(findNearbyPortal({ x: 0.6, y: 0, z: 0 }, [])).toBeNull();
	});
	it('deactivates as soon as the player leaves', () => {
		const player = { x: 0.5, y: 0, z: 0 };
		expect(findNearbyPortal(player, [portal])).toBe(portal);
		player.x = 1.1;
		expect(findNearbyPortal(player, [portal])).toBeNull();
	});
});

describe('portal destinations', () => {
	it('uses the requested blog in the current tab', () => {
		expect(getPortalUrl(portalConfig[0].url)).toBe('https://blog.zhihaojiang.com/');
		expect(portalConfig[0].openInNewTab).toBe(false);
	});
	it('preserves paths, search parameters and hashes', () => {
		expect(getPortalUrl('https://example.com/posts?a=1#latest')).toBe('https://example.com/posts?a=1#latest');
	});
	it.each(['javascript:alert(1)', 'data:text/html,test', '/relative', 'not-a-url', 'ftp://example.com'])('rejects non-web destination %s', (url) => {
		expect(getPortalUrl(url)).toBeNull();
	});
});
