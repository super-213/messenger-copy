/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE_PREFIX = 'messenger-pwa-';
const CACHE = `${CACHE_PREFIX}${version}`;
// Precache the iframe and all platform variants, not just assets loaded in the intro.
// source-manifest.json is a build diagnostic, not a game dependency.
// Hosting configuration files such as _headers are not public assets on Pages.
const gameFiles = files.filter((file) =>
	file === '/manifest.webmanifest' || file.startsWith('/icons/') || file.startsWith('/draco/') ||
	(file.startsWith('/original/') && file !== '/original/source-manifest.json')
);
const ASSETS = [...new Set(['/', ...build, ...gameFiles])];
const paths = new Set(ASSETS);

worker.addEventListener('install', (event) => {
	event.waitUntil((async () => {
		const cache = await caches.open(CACHE);
		try {
			// Limit simultaneous downloads so installation does not swamp the game loader.
			for (let i = 0; i < ASSETS.length; i += 8) {
				await cache.addAll(ASSETS.slice(i, i + 8).map((url) => new Request(url, { cache: 'reload' })));
			}
		} catch (error) {
			await caches.delete(CACHE);
			throw error;
		}
		// Keep updates waiting until existing game windows close. An active game must
		// not mix its original engine bundle with a newer deployment's resources.
	})());
});

worker.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		for (const name of await caches.keys()) {
			if (name.startsWith(CACHE_PREFIX) && name !== CACHE) await caches.delete(name);
		}
		await worker.clients.claim();
	})());
});

worker.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== worker.location.origin) return;
	// Query parameters (including ?debug) do not change these static resources or
	// the homepage shell. Never substitute the homepage for an unknown URL/404.
	if (!paths.has(url.pathname)) return;
	event.respondWith((async () => {
		const cache = await caches.open(CACHE);
		return (await cache.match(url.pathname)) ?? fetch(request);
	})());
});
