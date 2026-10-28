<script lang="ts">
	import { dev } from '$app/env';
</script>

<svelte:head>
	<title>Messenger · Zhihao</title>
	<meta name="description" content="探索小小星球，在小屋旁找到我的博客。" />
	{#if !dev}
		<script src="/pwa-register.js" defer></script>
	{/if}
</svelte:head>

<iframe src="/original/" title="Messenger 星球：探索地图，在小屋旁访问博客" allow="autoplay; fullscreen"></iframe>

<style>
	iframe { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; background: #66bfbd; }
</style>
