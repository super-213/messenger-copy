type ScriptTiming = {
	sourceURL?: string;
	sourceFunctionName?: string;
	duration: number;
	forcedStyleAndLayoutDuration?: number;
};
type LongFrame = PerformanceEntry & { blockingDuration?: number; scripts?: ScriptTiming[] };
type Context = { phase: string; portal: string | null; panelOpen: boolean };
type Sample = Context & {
	kind: 'long-animation-frame' | 'frame-gap';
	startTime: number;
	duration: number;
	blockingDuration: number | null;
	scripts: { file: string; function: string; duration: number; layout: number }[];
};
type Mark = Context & { name: string; startTime: number };

const LIMIT = 120;
const round = (value: number) => Math.round(value * 10) / 10;

/** Local, bounded diagnostics. No network requests, persistent storage or extra animation loop. */
export function createPerformanceMonitor() {
	const mode = typeof PerformanceObserver !== 'undefined' &&
		PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame') ? 'long-animation-frame' : 'frame-gap';
	let context: Context = { phase: 'loading', portal: null, panelOpen: false };
	let samples: Sample[] = [];
	let marks: Mark[] = [];
	let history = [{ ...context, startTime: 0 }];
	let count = 0;
	let worst = 0;
	let totalBlocking = 0;
	let resetAt = 0;
	let previousFrame: number | null = null;
	let suspended = document.hidden;
	let observer: PerformanceObserver | undefined;
	let observed = false;

	function setContext(next: Context) {
		if (next.phase === context.phase && next.portal === context.portal && next.panelOpen === context.panelOpen) return;
		context = { ...next };
		history.push({ ...context, startTime: performance.now() });
		if (history.length > LIMIT) history.shift();
	}
	function record(sample: Sample) {
		if (sample.startTime < resetAt) return;
		count++;
		worst = Math.max(worst, sample.duration);
		totalBlocking += sample.blockingDuration ?? 0;
		samples.push(sample);
		if (samples.length > LIMIT) samples.shift();
	}
	function collect(entries: PerformanceEntry[]) {
		if (suspended) return;
		for (const raw of entries) {
			const entry = raw as LongFrame;
			const state = history.findLast((item) => item.startTime <= entry.startTime) ?? history[0];
			record({
				phase: state.phase, portal: state.portal, panelOpen: state.panelOpen,
				kind: 'long-animation-frame', startTime: round(entry.startTime), duration: round(entry.duration),
				blockingDuration: round(entry.blockingDuration ?? 0),
				scripts: (entry.scripts ?? []).slice(0, 8).map((script) => {
					// Strip query strings and origins; exports never include full user URLs.
					let file = '';
					try { file = new URL(script.sourceURL ?? '', location.href).pathname; } catch { /* Unknown script. */ }
					return { file, function: (script.sourceFunctionName ?? '').slice(0, 100),
						duration: round(script.duration), layout: round(script.forcedStyleAndLayoutDuration ?? 0) };
				})
			});
		}
	}
	function startObserver() {
		if (mode !== 'long-animation-frame' || observer || suspended) return;
		observer = new PerformanceObserver((list) => collect(list.getEntries()));
		observer.observe({ type: 'long-animation-frame', buffered: !observed && resetAt === 0 });
		observed = true;
	}
	function suspend() {
		if (observer) { collect(observer.takeRecords()); observer.disconnect(); observer = undefined; }
		suspended = true;
		previousFrame = null;
	}
	function resume() {
		suspended = document.hidden;
		previousFrame = null;
		startObserver();
	}
	function snapshot() {
		if (observer) collect(observer.takeRecords());
		return {
			version: 1, mode, thresholdMs: 50, sampleLimit: LIMIT,
			count, worstMs: round(worst), blockingMs: mode === 'long-animation-frame' ? round(totalBlocking) : null,
			context: { ...context }, samples: structuredClone(samples), marks: structuredClone(marks)
		};
	}
	const api = {
		snapshot,
		reset() {
			observer?.takeRecords();
			samples = []; marks = []; count = 0; worst = 0; totalBlocking = 0;
			resetAt = performance.now(); previousFrame = null;
			history = [{ ...context, startTime: resetAt }];
		},
		download() {
			const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
			const link = document.createElement('a');
			link.href = url; link.download = 'messenger-performance.json'; link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		}
	};
	window.__messengerPerformance = api;
	startObserver();
	window.addEventListener('pagehide', suspend);
	window.addEventListener('pageshow', resume);
	document.addEventListener('visibilitychange', () => document.hidden ? suspend() : resume());
	return {
		api,
		frame(time: number, phase: string, portal: string | null, panelOpen: boolean) {
			setContext({ phase, portal, panelOpen });
			if (mode === 'frame-gap' && !suspended && previousFrame !== null && time - previousFrame >= 50) {
				record({ ...context, kind: 'frame-gap', startTime: round(previousFrame), duration: round(time - previousFrame),
					blockingDuration: null, scripts: [] });
			}
			previousFrame = suspended ? null : time;
		},
		mark(name: string, portal: string | null, panelOpen: boolean) {
			setContext({ ...context, portal, panelOpen });
			marks.push({ ...context, name, startTime: round(performance.now()) });
			if (marks.length > LIMIT) marks.shift();
		}
	};
}

declare global {
	interface Window {
		__messengerPerformance?: ReturnType<typeof createPerformanceMonitor>['api'];
	}
}
