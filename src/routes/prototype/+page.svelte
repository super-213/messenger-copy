<script lang="ts">
	import MessengerScene from '$lib/messenger/MessengerScene.svelte';
</script>

<svelte:head>
	<title>Zhihao · 小小世界</title>
	<meta name="description" content="在我的小小世界里散步。走近小屋，打开博客，看看我最近的记录与想法。" />
</svelte:head>

<main id="app">
	<MessengerScene mode="gameplay" />
	<header>
		<p class="name">ZHIHAO JIANG</p>
		<h1>小小世界</h1>
		<p class="description">四处走走，在小屋旁找到我的博客。</p>
	</header>
	<footer>
		<span>场景来自 <a href="https://messenger.abeto.co/" target="_blank" rel="noopener noreferrer">Messenger</a> / <a href="https://abeto.co/" target="_blank" rel="noopener noreferrer">abeto</a></span>
	</footer>
</main>

<style>
	main { position: absolute; inset: 0; overflow: hidden; background: #b8c9cf; }
	header { position: absolute; z-index: 2; top: 2rem; left: 2rem; pointer-events: none; color: #fff8e9; text-shadow: 0 2px 10px #1e353866; animation: appear 600ms ease-out; }
	.name { margin: 0 0 0.75rem; font-size: 0.65rem; letter-spacing: 0.24em; font-weight: 600; }
	h1 { margin: 0; font-family: 'Songti SC', 'STSong', serif; font-size: clamp(1.8rem, 3vw, 2.7rem); font-weight: 500; letter-spacing: 0.1em; }
	.description { margin: 0.7rem 0 0; font-size: 0.8rem; line-height: 1.5; }
	footer { position: absolute; bottom: 1rem; right: 1.5rem; z-index: 2; color: #fff8e9; text-shadow: 0 1px 5px #152427; font-size: 0.62rem; }
	a { color: inherit; text-underline-offset: 3px; }
	a:focus-visible { outline: 2px solid #edbd6e; outline-offset: 3px; }
	@keyframes appear { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
	@media (max-width: 600px) { header { top: 1.5rem; left: 1.25rem; } .description { max-width: 11rem; font-size: 0.72rem; } footer { right: 1rem; bottom: 0.7rem; font-size: 0.55rem; } }
	@media (prefers-reduced-motion: reduce) { header { animation: none; } }
</style>
