<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<script
		src="https://grist.numerique.gouv.fr/grist-plugin-api.js"
		strategy="beforeInteractive"
		async=""
	></script>
</svelte:head>

{@render children()}
