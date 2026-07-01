<script lang="ts">
	import { onMount } from 'svelte';
	import Handsontable from 'handsontable';
	import { registerAllModules } from 'handsontable/registry';

	registerAllModules();

	const COL_TOTAL = 'Cout_TTC';
	const COL_NB_JOURS = 'Nb_jours_numerique';

	let props = $props();

	const convertToMonths = (m) => {
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
		return mmonths.map(convertToMonths);
	});

	const rowData = $derived.by(() => {
		const dataByNames = {};
		props?.data?.rows?.records?.forEach((record) => {
			const personKey = record.Nom_court;
			dataByNames[personKey] = dataByNames[personKey] || {
				Personne: personKey,
				record,
				values: {}
			};

			const cellIds = record[props.data.rows.cellColumn];
			cellIds?.forEach((id) => {
				const idx = cellMap[id];
				const period = props.data.cells.Periode[idx];
				const month = convertToMonths(period);

				dataByNames[personKey].values[month] = dataByNames[personKey].values[month] || [];
				dataByNames[personKey].values[month].push(idx);
			});
		});
		const names = Object.keys(dataByNames);

		return names.map((n) => dataByNames[n]);
	});

	const tableData = $derived.by(() => {
		const data = rowData.map((person) => {
			return [
				person.Personne,
				...months.map((m) => {
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
	const validChangeSources = ['edit', 'CopyPaste.paste', 'Autofill.fill', 'UndoRedo.undo'];

	function beforeChange(changes, source) {
		if (validChangeSources.indexOf(source) < 0) {
			console.info('Invalid/unsupported source. Ignoring.');
			console.info({ changes, source });
			return false;
		}
		if (!changes) {
			console.info('no changes.');
			console.info({ source });
			return false;
		}
		if (changes.length !== 1) {
			console.info('too many changes.');
			console.info({ changes, source });
			return false;
		}
		return true;
	}

	function afterChange(changes, source) {
		if (validChangeSources.indexOf(source) < 0) {
			console.info('not an edit. Details:');
			console.info({ changes, source });
			return;
		}
		if (!changes) {
			console.info('no changes.');
			console.info({ source });
			return;
		}
		if (changes.length !== 1) {
			console.info('too many changes.');
			console.info({ changes, source });
			return;
		}
		const row = changes[0][0];
		const column = changes[0][1];
		const inputIdx = getCellData(row, column);
		if (!inputIdx) {
			const rowItem = rowData[row];
			const monthValue = months[column - 1];
			const value = changes[0][3];
			props?.afterNewCell?.(rowItem.record.id, monthValue, value);
			return;
		}
		if (inputIdx.length !== 1) {
			console.info('too many inputs.');
			return;
		}
		const cellId = props.data.cells.id[inputIdx[0]];
		const newValue = changes[0][3];
		props?.afterCellChange?.(cellId, newValue);
	}

	let gridElement;
	let hot;

	const colHeaders = $derived(['Intervention', ...(months || []), '', 'Total']);
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
			height: '95vh',
			colHeaders: (i) => colHeaders[i],
			columns: (i) => columns[i],
			fixedColumnsStart: 1,
			fixedColumnsEnd: 1,
			fixedRowsBottom: 1,
			beforeChange,
			afterChange: afterChange,
			afterSelectionEnd: afterSelectionEnd,
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
