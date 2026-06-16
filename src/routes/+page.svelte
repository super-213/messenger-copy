<script lang="ts">
	import MessengerScene from '$lib/messenger/MessengerScene.svelte';
</script>

<svelte:head>
	<title>Messenger Copy</title>
	<meta
		name="description"
		content="Local rebuild workspace for messenger.abeto.co assets, shaders, and styles."
	/>
</svelte:head>

<main id="app" class="messenger-app">
	<MessengerScene />
	<header class="messenger-overlay">
		<p class="eyebrow">Reference preview</p>
		<h1>Messenger</h1>
		<p class="lede">Draco planet geometry from the captured intro scene.</p>
	</header>
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
		pointer-events: none;
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
</style>
