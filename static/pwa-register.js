// The homepage is static HTML with no Svelte hydration bundle. Keep PWA
// registration independent of the framework, without blocking the game iframe.
if ('serviceWorker' in navigator) {
	addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js').catch((error) => {
			console.warn('Offline cache registration failed; the online game remains available.', error);
		});
	}, { once: true });
}
