declare interface Window {
	grist: any;
}
declare interface GristColumnFields {
	type: string;
}
declare interface GristColumn {
	id: string;
	fields: GristColumnFields;
}

declare interface Cells {
	id: number[];
	Periode: number[];
	Cout_TTC: number[];
	Nb_jours_numerique: number[];
	Statut: string[];
}
