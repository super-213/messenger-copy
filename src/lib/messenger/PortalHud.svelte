<script lang="ts">
	import { page } from '$app/state';
	import type { GameplayController, MovementKey, PortalSnapshot } from './createGameplayController';
	import { getPortalUrl, portalConfig } from './portalConfig';

	let { controller, snapshot, status }: {
		controller: GameplayController | null;
		snapshot: PortalSnapshot | null;
		status: 'loading' | 'ready' | 'error';
	} = $props();
	let nearby = $derived(snapshot?.nearby);
	let href = $derived(nearby ? getPortalUrl(nearby.url) : null);
	const directions: { key: MovementKey; label: string; arrow: string }[] = [
		{ key: 'up', label: '向前移动', arrow: '↑' },
		{ key: 'left', label: '向左移动', arrow: '←' },
		{ key: 'down', label: '向后移动', arrow: '↓' },
		{ key: 'right', label: '向右移动', arrow: '→' }
	];

	function holdDirection(key: MovementKey) {
		return (button: HTMLButtonElement) => {
			const down = (event: PointerEvent) => {
				if (event.button !== 0) return;
				event.preventDefault();
				button.setPointerCapture(event.pointerId);
				controller?.setMovement(key, true);
			};
			const release = () => controller?.setMovement(key, false);
			const keydown = (event: KeyboardEvent) => {
				if (event.code === 'Space' || event.code === 'Enter') {
					event.preventDefault();
					controller?.setMovement(key, true);
				}
			};
			const keyup = (event: KeyboardEvent) => {
				if (event.code === 'Space' || event.code === 'Enter') release();
			};
			button.addEventListener('pointerdown', down);
			button.addEventListener('pointerup', release);
			button.addEventListener('pointercancel', release);
			button.addEventListener('lostpointercapture', release);
			button.addEventListener('keydown', keydown);
			button.addEventListener('keyup', keyup);
			button.addEventListener('blur', release);
			return () => {
				release();
				button.removeEventListener('pointerdown', down);
				button.removeEventListener('pointerup', release);
				button.removeEventListener('pointercancel', release);
				button.removeEventListener('lostpointercapture', release);
				button.removeEventListener('keydown', keydown);
				button.removeEventListener('keyup', keyup);
				button.removeEventListener('blur', release);
			};
		};
	}

	function enterPortal(event: MouseEvent) {
		if (!nearby || !controller?.canEnter(nearby.id)) event.preventDefault();
		else controller.stop();
	}
</script>

{#if status === 'ready' && controller}
	<button class="reset" type="button" onclick={() => controller?.reset()} aria-label="回到小屋附近的起点">
		<span aria-hidden="true">↺</span> 回到起点
	</button>
	{#if snapshot?.sign.visible}
		<div class="place-label" class:available={Boolean(nearby)} style:left="{snapshot.sign.x}%" style:top="{snapshot.sign.y}%">
			<span class="dot"></span>{snapshot.closest.title}<span class="place-detail">小屋旁</span>
		</div>
	{/if}
	<div class="portal-prompt" aria-live="polite" aria-atomic="true">
		{#if nearby}
			<div class="destination">
				<div class="destination-copy">
					<span class="overline">已到达 · 小屋旁</span>
					<h2>{nearby.title}</h2>
					<p>{nearby.description}</p>
				</div>
				{#if href}
					<a class="enter" {href} target={nearby.openInNewTab ? '_blank' : '_self'}
						rel="external noopener noreferrer" onclick={enterPortal}>
						访问{nearby.title} <span aria-hidden="true">↗</span>
					</a>
				{:else}
					<span class="invalid-url">入口地址暂不可用</span>
				{/if}
			</div>
		{:else}
			<p class="walk-hint"><span class="dot"></span>走近小屋旁的光圈，访问博客</p>
		{/if}
	</div>
	<p class="controls-hint"><span>W A S D / 方向键</span> 移动 <i>·</i> 点击附近地面也可以行走</p>
	<div class="touch-controls" role="group" aria-label="角色移动">
		{#each directions as direction (direction.key)}
			<button type="button" class={direction.key} aria-label={direction.label}
				{@attach holdDirection(direction.key)}>{direction.arrow}</button>
		{/each}
	</div>
	{#if page.url.searchParams.has('debug')}
		<output class="coordinates">角色方向：[{snapshot?.coordinates}]</output>
	{/if}
{:else if status === 'error'}
	<div class="fallback">
		<p>也可以直接访问：</p>
		{#each portalConfig as project (project.id)}
			{@const url = getPortalUrl(project.url)}
			{#if url}
				<a href={url} target={project.openInNewTab ? '_blank' : '_self'} rel="external noopener noreferrer">{project.title} ↗</a>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.reset, .place-label, .portal-prompt, .controls-hint, .touch-controls, .coordinates, .fallback { position: absolute; z-index: 3; }
	.reset { top: 2rem; right: 2rem; display: flex; align-items: center; gap: 0.55rem; padding: 0.65rem 1rem; border: 1px solid rgb(255 255 255 / 45%); border-radius: 99px; background: rgb(245 242 231 / 88%); color: #293d40; font-size: 0.8rem; cursor: pointer; }
	.reset span { font-size: 1.25rem; line-height: 1; }
	.reset:hover { background: #fff8e9; }
	.place-label { transform: translate(-50%, -100%); display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; padding: 0.6rem 0.9rem; border-radius: 8px; background: #f5efdf; color: #293d40; box-shadow: 0 3px 14px #15242730; font-size: 0.85rem; pointer-events: none; }
	.place-label::after { content: ''; position: absolute; top: 100%; left: calc(50% - 5px); border: 5px solid transparent; border-top-color: #f5efdf; }
	.place-detail { padding-left: 0.5rem; border-left: 1px solid #293d4030; font-size: 0.7rem; opacity: 0.65; }
	.dot { display: inline-block; width: 7px; height: 7px; border-radius: 100%; background: #ba7b3e; flex-shrink: 0; }
	.available .dot { background: #41825c; }
	.portal-prompt { bottom: 5.8rem; left: 50%; transform: translateX(-50%); width: max-content; max-width: calc(100% - 3rem); }
	.destination { display: flex; align-items: center; gap: 3rem; padding: 1.15rem 1.25rem 1.15rem 1.5rem; border-radius: 14px; background: #f8f3e6; box-shadow: 0 12px 40px #14252933; animation: arrive 220ms ease-out; }
	.overline { color: #65806e; font-size: 0.65rem; letter-spacing: 0.1em; }
	h2 { margin: 0.25rem 0; color: #293d40; font-size: 1.25rem; font-weight: 600; }
	.destination p { margin: 0; color: #667273; font-size: 0.8rem; }
	.enter { display: flex; gap: 1.5rem; align-items: center; min-height: 46px; padding: 0 1.15rem; background: #293d40; color: #fff8e9; border-radius: 7px; text-decoration: none; white-space: nowrap; font-size: 0.85rem; transition: background 150ms, transform 150ms; }
	.enter:hover { background: #3e5959; transform: translateY(-2px); }
	.enter span { font-size: 1.2rem; }
	.walk-hint { display: flex; align-items: center; gap: 0.6rem; margin: 0; padding: 0.8rem 1.1rem; background: #f8f3e6ed; color: #35494b; border-radius: 99px; font-size: 0.85rem; }
	.controls-hint { bottom: 2.8rem; left: 50%; width: max-content; transform: translateX(-50%); color: #fff8e9; text-shadow: 0 1px 5px #152427; font-size: 0.72rem; }
	.controls-hint span { font-weight: 600; }
	.controls-hint i { padding: 0 0.6rem; font-style: normal; }
	.touch-controls { display: none; left: 1rem; bottom: 3rem; grid-template-columns: repeat(3, 46px); grid-template-rows: repeat(2, 46px); gap: 4px; }
	.touch-controls button { border: 1px solid #fff6; border-radius: 10px; background: #f8f3e6e8; color: #293d40; font-size: 1.2rem; touch-action: none; user-select: none; }
	.touch-controls button:active { background: #e7cd9d; }
	.up { grid-column: 2; }
	.left { grid-column: 1; grid-row: 2; }
	.down { grid-column: 2; grid-row: 2; }
	.right { grid-column: 3; grid-row: 2; }
	.coordinates { top: 7rem; right: 1rem; padding: 0.5rem; background: #f8f3e6; font: 11px monospace; color: #293d40; user-select: all; }
	.fallback { left: 50%; top: 58%; transform: translateX(-50%); text-align: center; color: #293d40; background: #f8f3e6; padding: 1rem 2rem; border-radius: 12px; }
	.fallback a { display: block; padding: 0.5rem; color: inherit; }
	.invalid-url { font-size: 0.8rem; color: #945139; }
	a:focus-visible, button:focus-visible { outline: 3px solid #edbd6e; outline-offset: 4px; }
	@keyframes arrive { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
	@media (pointer: coarse) { .touch-controls { display: grid; } .controls-hint { display: none; } .portal-prompt { bottom: 11rem; } }
	@media (max-width: 600px) {
		.reset { top: 1.25rem; right: 1rem; padding: 0.55rem 0.75rem; font-size: 0.72rem; }
		.destination { gap: 1.25rem; padding: 1rem; }
		.destination p { max-width: 10rem; line-height: 1.5; }
		.enter { padding: 0 0.8rem; gap: 0.6rem; }
		.controls-hint { font-size: 0.6rem; }
		.walk-hint { font-size: 0.75rem; }
	}
	@media (prefers-reduced-motion: reduce) { .destination { animation: none; } .enter { transition: none; } }
</style>
