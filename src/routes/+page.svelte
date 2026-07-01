<script lang="ts">
	import Previsionnel from '$lib/Previsionnel.svelte';
	let data = $state();
	let cellTable = $state();

	$effect(() => {
		window.grist.ready({
			allowSelectBy: true,
			requiredAccess: 'full'
		});
		window.grist.onRecords(
			async (records) => {
				const cellColumn = 'Consommations';
				const tableId = await window.grist.getTable().getTableId();

				const tokenInfo = await grist.docApi.getAccessToken({ readOnly: true });
				const columnsUrl = `${tokenInfo.baseUrl}/tables/${tableId}/columns?hidden=true?auth=${tokenInfo.token}`;
				const columnsResponse = await fetch(columnsUrl);
				const { columns } = await columnsResponse.json();

				const cellColumnMeta = columns.find((v) => v.id == cellColumn);
				cellTable = cellColumnMeta.fields.type.split(':')[1];
				const cells = await grist.docApi.fetchTable(cellTable);

				data = { rows: { records, columns, cellColumn }, cells };
			},
			{
				expandRefs: false,
				includeColumns: 'all'
			}
		);
	});

	async function afterNewCell(rowId, monthValue, value) {
		const payload = {
			fields: {
				Intervention_validee: rowId,
				Nb_jours: value,
				Periode: monthValue + '-01'
			}
		};
		await window.grist.getTable(cellTable).create(payload);
	}

	async function afterCellChange(id, value) {
		const payload = {
			id,
			fields: {
				Nb_jours: value
			}
		};
		await window.grist.getTable(cellTable).update(payload);
	}

	function afterSelectionEnd(input) {
		console.log({ input });
	}
</script>

<Previsionnel {data} {afterCellChange} {afterNewCell} {afterSelectionEnd} />
