<script lang="ts">
	import { onMount } from 'svelte';
	import Handsontable from 'handsontable';
	import { registerAllModules } from 'handsontable/registry';

	registerAllModules();

	const COL_TOTAL = 'Cout_TTC';
	const COL_NB_JOURS = 'Nb_jours_numerique';

	let props = $props();

	interface Record {
		Nom_court: string;
		Consommations: number[];
	}
	interface Rows {
		records: Record[];
		cellColumn: string;
	}
	let rows: Rows = $derived(props?.data?.rows);
	let cells: Cells = $derived(props?.data?.cells);

	const convertToMonths = (m: number) => {
		const c = new Date(m * 1000);
		return c.toISOString().slice(0, 7);
	};
	const accSum = (a: number, v: number) => a + (v || 0);
	const amountDisplay = (v: number) =>
		v.toLocaleString('FR-fr', { style: 'currency', currency: 'EUR' });

	interface CellMap {
		[key: number]: number;
	}
	let cellMap: CellMap = $derived(
		cells?.id?.reduce((a, v: number, i: number) => {
			a[v] = i;
			return a;
		}, {} as CellMap)
	);

	const months = $state(
		[...Array(24+3).keys()].map((v) => new Date(2026, v + 1, 1).toISOString().slice(0, 7))
	);

	interface PeriodData {
		[key: string]: number[];
	}
	interface RowData {
		Personne: string;
		record: any;
		values: PeriodData;
	}
	const rowData: RowData[] = $derived.by(() => {
		const dataByNames: { [key: string]: RowData } = {};
		rows?.records?.forEach((record) => {
			const personKey = record.Nom_court;
			dataByNames[personKey] = dataByNames[personKey] || {
				Personne: personKey,
				record,
				values: {}
			};

			const cellIds = record[rows.cellColumn] as number[];
			cellIds?.forEach((id) => {
				const idx = cellMap[id];
				const period = cells.Periode[idx];
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
					return person.values[m]?.map((idx) => cells[COL_NB_JOURS][idx]).reduce(accSum, 0);
				})
			];
		});

		data.forEach((r, i) => {
			r.push('');
			const v = months
				.map((m) => {
					const person = rowData[i];
					return person.values[m]?.map((idx) => cells[COL_TOTAL][idx]).reduce(accSum, 0);
				})
				.reduce(accSum, 0);
			r.push(amountDisplay(v));
		});

		const sumData: Handsontable.CellValue[] = months.map((m) => {
			const total = rowData
				.map((r) => {
					return r.values[m]?.map((idx) => cells[COL_TOTAL][idx]).reduce(accSum, 0);
				})
				.reduce(accSum, 0);
			return total;
		});

		const fullSum = sumData.reduce(accSum, 0);
		sumData.push('');
		sumData.push(fullSum);

		return [...data, [], ['Total', ...sumData.map(amountDisplay)]];
	});

	const getCellData = (row: number, column: any) => {
		const details = rowData[row];
		return details?.values?.[months[column - 1]];
	};

	function afterSelectionEnd(row: number, column: number) {
		if (row < 0) {
			return;
		}
		const input = getCellData(row, column);
		props?.afterSelectionEnd?.(input);
	}
	const validChangeSources = ['edit', 'CopyPaste.paste', 'Autofill.fill', 'UndoRedo.undo'];

	function beforeChange(
		changes: (Handsontable.CellChange | null)[],
		source: Handsontable.ChangeSource
	) {
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

	function afterChange(
		changes: Handsontable.CellChange[] | null,
		source: Handsontable.ChangeSource
	) {
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
		const cellId = cells.id[inputIdx[0]];
		const newValue = changes[0][3];
		props?.afterCellChange?.(cellId, newValue);
	}

	let gridElement: HTMLElement;
	let hot: Handsontable;

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

	function cellsMeta(row: number, column: number): Handsontable.CellMeta {
		const cellProperties: Handsontable.CellMeta = {};
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
				if (input.filter((idx) => cells.Statut[idx] === 'Consommé').length === input.length) {
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
			fixedRowsBottom: 1,
			beforeChange,
			afterChange,
			afterSelectionEnd,
			copyPaste: true,
			cells: cellsMeta,
			licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
		});
	});

	$effect(() => {
		hot.loadData(tableData);
	});
</script>

<div bind:this={gridElement}></div>
