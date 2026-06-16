<script lang="ts">
	import MessengerScene from '$lib/messenger/MessengerScene.svelte';
	import type { SceneMode } from '$lib/messenger/introAssets';

	let sceneMode = $state<SceneMode>('intro');

	const modeDescriptions: Record<SceneMode, string> = {
		intro: 'Intro planet with ported atlas, water, and cloud shaders.',
		gameplay: 'Present-day terrain, tree foliage, batched water, VFX props, and LUT outlines.',
		npcs: 'NPC gallery on a studio stage with static or skinned idle meshes.'
	};
</script>

<svelte:head>
	<title>Messenger Copy — learning preview</title>
	<meta
		name="description"
		content="Unofficial AI-assisted learning rebuild of messenger.abeto.co assets, shaders, and styles."
	/>
</svelte:head>

<main id="app" class="messenger-app">
	{#key sceneMode}
		<MessengerScene mode={sceneMode} />
	{/key}
	<header class="messenger-overlay">
		<p class="eyebrow">Reference preview</p>
		<h1>Messenger</h1>
		<p class="lede">{modeDescriptions[sceneMode]}</p>
		<div class="mode-toggle" role="group" aria-label="Scene mode">
			<button
				type="button"
				class:active={sceneMode === 'intro'}
				onclick={() => (sceneMode = 'intro')}
			>
				Intro
			</button>
			<button
				type="button"
				class:active={sceneMode === 'gameplay'}
				onclick={() => (sceneMode = 'gameplay')}
			>
				Gameplay
			</button>
			<button
				type="button"
				class:active={sceneMode === 'npcs'}
				onclick={() => (sceneMode = 'npcs')}
			>
				NPCs
			</button>
		</div>
	</header>
	<footer class="messenger-attribution">
		<p>
			Unofficial learning project. Original game:
			<a href="https://messenger.abeto.co/" target="_blank" rel="noopener noreferrer"
				>messenger.abeto.co</a
			>
			by <a href="https://abeto.co/" target="_blank" rel="noopener noreferrer">abeto</a>.
		</p>
		<p>
			This repo is for study only and was largely <strong>AI-generated</strong>. Code is
			<a href="https://github.com/arafays/messenger-copy/blob/main/LICENSE" target="_blank" rel="noopener noreferrer"
				>MIT</a
			>; assets remain with the original creator.
			<a href="https://github.com/arafays/messenger-copy/blob/main/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer"
				>Attribution</a
			>
		</p>
	</footer>
</main>

<style>
	.messenger-app {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #fff;
	}

	.messenger-overlay {
		position: absolute;
		top: 1.5rem;
		left: 1.5rem;
		z-index: 2;
		max-width: 18rem;
		padding: 1rem 1.1rem;
		border-radius: 0.9rem;
		background: rgb(255 255 255 / 0.82);
		backdrop-filter: blur(10px);
		box-shadow: 0 10px 30px rgb(20 32 40 / 0.12);
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #6b7a82;
	}

	h1 {
		margin: 0;
		font-size: 1.6rem;
		line-height: 1.1;
		color: #1f2a30;
	}

	.lede {
		margin: 0.55rem 0 0;
		font-size: 0.92rem;
		line-height: 1.45;
		color: #4d5c64;
	}

	.mode-toggle {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.85rem;
	}

	.mode-toggle button {
		flex: 1 1 calc(33% - 0.45rem);
		min-width: 4.5rem;
		padding: 0.45rem 0.65rem;
		border: 1px solid #c8d2d8;
		border-radius: 0.55rem;
		background: #fff;
		color: #42515a;
		font-size: 0.82rem;
		cursor: pointer;
		transition: background 120ms ease, border-color 120ms ease;
	}

	.mode-toggle button:hover {
		border-color: #9aabb4;
	}

	.mode-toggle button.active {
		border-color: #5a6d78;
		background: #eef3f6;
		color: #1f2a30;
	}

	.messenger-attribution {
		position: absolute;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 2;
		max-width: 22rem;
		padding: 0.75rem 0.95rem;
		border-radius: 0.75rem;
		background: rgb(255 255 255 / 0.82);
		backdrop-filter: blur(10px);
		box-shadow: 0 8px 24px rgb(20 32 40 / 0.1);
		font-size: 0.78rem;
		line-height: 1.45;
		color: #4d5c64;
	}

	.messenger-attribution p {
		margin: 0;
	}

	.messenger-attribution p + p {
		margin-top: 0.45rem;
	}

	.messenger-attribution a {
		color: #2f5f78;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.messenger-attribution a:hover {
		color: #1f2a30;
	}
</style>
