<script lang="ts">
	import { onMount } from 'svelte';
	import Handsontable from 'handsontable';
	import { registerAllModules } from 'handsontable/registry';

	registerAllModules();

	const COL_TOTAL = 'Cout_TTC';
	const COL_NB_JOURS = 'Nb_jours_numerique';

	let props = $props();

	const formatMonthHeader = (m) => {
		const c = new Date(parseInt(m) * 1000);
		return c.toISOString().slice(0, 7);
	};
	const accSum = (a, v) => a + (v || 0);
	const amountDisplay = (v) => v.toLocaleString('FR-fr', { style: 'currency', currency: 'EUR' });

	let cellMap = $derived(
		props?.data?.cells?.id?.reduce((a, v, i) => {
			a[v] = i;
			return a;
		}, {})
	);

	const months = $derived.by(() => {
		const mmonths = Array.from(new Set(props?.data?.cells?.Periode));
		mmonths.sort();
		return mmonths;
	});

	const rowData = $derived.by(() => {
		const dataByNames = {};
		props?.data?.rows?.records?.forEach((r) => {
			const personKey = r.Nom_court;
			dataByNames[personKey] = dataByNames[personKey] || {
				Personne: personKey,
				values: {}
			};

			const cellIds = r[props.data.rows.cellColumn];
			cellIds?.forEach((id) => {
				const idx = cellMap[id];
				const period = props.data.cells.Periode[idx];

				dataByNames[personKey].values[period] = dataByNames[personKey].values[period] || [];
				dataByNames[personKey].values[period].push(idx);
			});
		});
		const names = Object.keys(dataByNames);

		return names.map((n) => dataByNames[n]);
	});

	const tableData = $derived.by(() => {
		const data = rowData.map((person) => {
			return [
				person.Personne,
				...months.map((m, i) => {
					return person.values[m]
						?.map((idx) => props.data.cells[COL_NB_JOURS][idx])
						.reduce(accSum, 0);
				})
			];
		});

		data.forEach((r, i) => {
			r.push('');
			const v = months
				.map((m) => {
					const person = rowData[i];
					return person.values[m]?.map((idx) => props.data.cells[COL_TOTAL][idx]).reduce(accSum, 0);
				})
				.reduce(accSum, 0);
			r.push(amountDisplay(v));
		});

		const sumData = months.map((m) => {
			const total = rowData
				.map((r) => {
					return r.values[m]?.map((idx) => props.data.cells[COL_TOTAL][idx]).reduce(accSum, 0);
				})
				.reduce(accSum, 0);
			return total;
		});

		const fullSum = sumData.reduce(accSum, 0);
		sumData.push('');
		sumData.push(fullSum);

		return [...data, [], ['Total', ...sumData.map(amountDisplay)]];
	});

	const getCellData = (row, column) => {
		const details = rowData[row];
		return details?.values?.[months[column - 1]];
	};

	function afterSelectionEnd(row, column) {
		if (row < 0) {
			return;
		}
		const input = getCellData(row, column);
		props?.afterSelectionEnd?.(input);
	}

	function afterChange(changes, source) {
		if (source !== 'edit') {
			console.info('not an edit.');
			return;
		}
		if (changes.length !== 1) {
			console.info('too many changes.');
			return;
		}
		const row = changes[0][0];
		const column = changes[0][1];
		const inputIdx = getCellData(row, column);
		if (inputIdx.length !== 1) {
			console.info('too many inputs.');
			return;
		}
		const input = props.data.cells.id[inputIdx[0]];
		console.log({ ii: inputIdx[0], input });
		props?.afterChange?.(input, changes, source);
	}

	let gridElement;
	let hot;

	const colHeaders = $derived([
		'Intervention',
		...(months.map(formatMonthHeader) || []),
		'',
		'Total'
	]);
	const columns = $derived([
		{
			type: 'text',
			readOnly: true
		},
		...[...months, ...['', 'Total']].map(() => {
			return {
				type: 'numeric',
				className: 'htRight'
			};
		})
	]);

	function cells(row, column) {
		const cellProperties = {};
		if (row >= rowData.length || column > months.length) {
			cellProperties.readOnly = true;
		} else if (column > 0) {
			const input = getCellData(row, column);
			if (input) {
				const classNames = [];
				if (input.length > 1) {
					classNames.push('italic');
					cellProperties.readOnly = true;
				}
				if (input.filter((c) => c.Statut === 'Consommé').length === input.length) {
					classNames.push('bold');
					cellProperties.readOnly = true;
				}
				cellProperties.className = classNames.join(' ');
			}
		}
		return cellProperties;
	}

	onMount(() => {
		hot = new Handsontable(gridElement, {
			rowHeaders: false,
			height: 'auto',
			colHeaders: (i) => colHeaders[i],
			columns: (i) => columns[i],
			fixedColumnsStart: 1,
			afterSelectionEnd: afterSelectionEnd,
			afterChange: afterChange,
			copyPaste: true,
			cells,
			licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
		});
	});

	$effect(() => {
		hot.loadData(tableData);
	});
</script>

<div bind:this={gridElement}></div>
