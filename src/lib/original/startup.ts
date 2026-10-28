type PrefetchManifest = { common: string[]; low: string[]; standard: string[] };

let started = false;
let stopped = false;

/** Fetch compressed files only. Never allocate a second scene or decode models. */
export function prefetchGameplay(lowMemory: boolean) {
	if (started) return;
	started = true;
	// An active worker already has the complete game in its versioned cache.
	if (navigator.serviceWorker?.controller) return;
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	if (connection?.saveData) return;
	// Let the first intro frame paint before competing for bandwidth.
	setTimeout(() => { void warmFiles(lowMemory).catch(() => {}); }, 250);
}

async function warmFiles(lowMemory: boolean) {
	if (stopped) return;
	const response = await fetch(new URL('./gameplay-prefetch.json', import.meta.url), { priority: 'low' });
	if (!response.ok || stopped) return;
	const manifest: PrefetchManifest = await response.json();
	const priority = (url: string) => url.includes('hitmesh') ? 0 : url.endsWith('.ktx2') ? 1 :
		url.endsWith('.js') ? 2 : /\/full_\d+\.drc$/.test(url) ? 3 :
		url.endsWith('.drc') ? 4 : 5;
	const urls = [...manifest.common, ...(lowMemory ? manifest.low : manifest.standard)]
		.sort((a, b) => priority(a) - priority(b));
	performance.mark('messenger:prefetch-start');
	let index = 0;
	async function download() {
		while (!stopped && !navigator.serviceWorker?.controller && index < urls.length) {
			if (document.visibilityState === 'hidden') {
				await new Promise<void>((resolve) => {
					function visible() {
						if (document.visibilityState === 'hidden' && !stopped) return;
						document.removeEventListener('visibilitychange', visible);
						resolve();
					}
					document.addEventListener('visibilitychange', visible);
				});
				if (stopped) return;
			}
			const url = urls[index++];
			try {
				const file = await fetch(url, { cache: 'force-cache', priority: 'low' });
				// Consume the response to complete the HTTP cache entry, then release
				// the compressed bytes. Failed prefetches are retried by the real loader.
				if (file.ok) await file.arrayBuffer();
			} catch { /* A speculative request must never block BEGIN. */ }
		}
	}
	await Promise.all([download(), download()]);
}

export function stopGameplayPrefetch() {
	// Let at most two in-flight downloads finish; don't waste partially received
	// files by aborting them. Stop adding requests once gameplay needs bandwidth.
	stopped = true;
}

export function motionTime(seconds: number) {
	return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : seconds;
}

addEventListener('pagehide', stopGameplayPrefetch);
