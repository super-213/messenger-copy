import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:4173').origin;
// A temporary regular profile permits real installability checks; incognito
// contexts always report "in-incognito" even for a correctly configured PWA.
for (const mobile of [false, true]) {
	const profile = await mkdtemp(join(tmpdir(), 'messenger-pwa-'));
	const context = await chromium.launchPersistentContext(profile, {
		channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
		...(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 950 } })
	});
	try {
		let page = await context.newPage();
		const errors = [];
		const failedResponses = [];
		context.on('page', (newPage) => newPage.on('pageerror', (error) => errors.push(error.message)));
		page.on('pageerror', (error) => errors.push(error.message));
		context.on('response', (response) => {
			if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
		});
		// Activation must remove only this app's old caches, preserving other data.
		await page.goto(`${origin}/robots.txt`);
		await page.evaluate(async () => {
			await caches.open('messenger-pwa-obsolete-test');
			await caches.open('unrelated-app-test');
		});
		await page.goto(origin);
		await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120000 });
		const manifest = await page.evaluate(async () => {
			const link = document.querySelector('link[rel="manifest"]');
			return (await fetch(link.href)).json();
		});
		assert.equal(manifest.display, 'standalone');
		assert.equal(manifest.start_url, '/');
		assert.equal(manifest.id, '/');
		for (const icon of manifest.icons) {
			const dimensions = await page.evaluate(async (src) => {
				const image = new Image();
				image.src = src;
				await image.decode();
				return `${image.naturalWidth}x${image.naturalHeight}`;
			}, icon.src);
			assert.equal(dimensions, icon.sizes);
		}
		const cdp = await context.newCDPSession(page);
		const appManifest = await cdp.send('Page.getAppManifest');
		assert.deepEqual(appManifest.errors, [], 'Chrome parses the install manifest');
		const installability = await cdp.send('Page.getInstallabilityErrors');
		assert.deepEqual(installability.installabilityErrors, [], 'Chrome PWA installability checks pass');
		const cacheInfo = await page.evaluate(async () => {
			const names = await caches.keys();
			const current = names.find((name) => name.startsWith('messenger-pwa-'));
			return { names, paths: (await (await caches.open(current)).keys()).map((request) => new URL(request.url).pathname) };
		});
		assert.ok(cacheInfo.names.includes('unrelated-app-test'));
		assert.ok(!cacheInfo.names.includes('messenger-pwa-obsolete-test'));
		assert.equal(cacheInfo.names.filter((name) => name.startsWith('messenger-pwa-')).length, 1);
		const originalFiles = await readdir(new URL('../static/original/', import.meta.url), { recursive: true, withFileTypes: true });
		for (const file of originalFiles.filter((entry) => entry.isFile() && entry.name !== 'source-manifest.json')) {
			const path = join(file.parentPath, file.name).split('/static/')[1];
			assert.ok(cacheInfo.paths.includes(path === 'original/index.html' ? '/original/' : `/${path}`), `Precached before gameplay: ${path}`);
		}
		assert.ok(cacheInfo.paths.includes('/'));
		assert.ok(!cacheInfo.paths.includes('/_headers'));

		// A fresh page while offline proves this is persisted SW caching, rather
		// than an already-running game or the previous page's memory cache.
		await context.setOffline(true);
		await page.close();
		page = await context.newPage();
		const offlineCdp = await context.newCDPSession(page);
		await offlineCdp.send('Network.enable');
		await offlineCdp.send('Network.setCacheDisabled', { cacheDisabled: true });
		const requested = new Set();
		const servedByWorker = new Set();
		page.on('request', (request) => requested.add(new URL(request.url()).pathname));
		page.on('response', (response) => {
			if (response.fromServiceWorker()) servedByWorker.add(new URL(response.url()).pathname);
		});
		const offlineResponse = await page.goto(`${origin}/?debug`, { waitUntil: 'load' });
		assert.ok(offlineResponse.fromServiceWorker(), 'Offline homepage is served by the Service Worker');
		const body = await page.frameLocator('iframe').locator('body').elementHandle();
		const frame = await body.ownerFrame();
		await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'intro', null, { timeout: 60000 });
		await page.waitForTimeout(7000);
		const viewport = page.viewportSize();
		if (mobile) await page.touchscreen.tap(viewport.width / 2, viewport.height * 0.868);
		else await page.mouse.click(viewport.width / 2, viewport.height * 0.868, { delay: 100 });
		await frame.waitForFunction(() => window.__originalMessenger?.controller.state === 'present', null, { timeout: 90000 });
		await frame.locator('#localized-dialogue').waitFor({ state: 'visible', timeout: 30000 });
		assert.ok(servedByWorker.has('/original/'), 'Game iframe is served by the Service Worker');
		if (mobile) {
			assert.ok(requested.has('/original/assets/geometries/planets/present/low/full_0.drc'));
			assert.ok(requested.has('/original/assets/audio/music/bgmusic-mobile.mp3'));
		}
		const uncached = await page.evaluate(async () => {
			try { return (await fetch('/not-a-cached-page')).ok; } catch { return false; }
		});
		assert.equal(uncached, false, 'Unknown offline URLs do not get a bogus homepage response');
		assert.deepEqual(errors, []);
		assert.deepEqual(failedResponses, []);
		console.log(`${mobile ? 'Mobile' : 'Desktop'} PWA passed: installability, icons, ${cacheInfo.paths.length} cached resources, cache cleanup, fresh offline launch and entering the game.`);
	} finally {
		await context.close();
		await rm(profile, { recursive: true, force: true });
	}
}
