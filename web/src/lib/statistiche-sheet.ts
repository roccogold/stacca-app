import { google } from "googleapis";
import { loadServiceAccountCredentials } from "@/lib/google-sheets";

/**
 * Costruisce (idempotente) il tab "Statistiche" sul foglio Google: una
 * dashboard con menu a tendina Anno, 3 KPI e 4 grafici nei colori Stacca.
 *
 * Si aggiorna DA SOLA: tutte le aggregazioni sono formule QUERY/SUMIFS che
 * leggono dal tab master "Ore Totali" (già sincronizzato a ogni voce). Lo
 * script va eseguito una volta (e di nuovo solo se si vuole rigenerare il
 * layout): `npm run sheets:statistiche`.
 *
 * Le formule stanno in un tab nascosto "Dati Statistiche" così la dashboard
 * resta pulita; i grafici puntano lì.
 */

const STATS_TAB = "Statistiche";
const DATA_TAB = "Dati Statistiche";

// Colori brand Stacca (vedi globals.css → --stacca-olive / --stacca-terra).
const OLIVE = { red: 61 / 255, green: 74 / 255, blue: 53 / 255 }; // #3d4a35
const TERRA = { red: 99 / 255, green: 46 / 255, blue: 36 / 255 }; // #632e24
const INK = { red: 42 / 255, green: 37 / 255, blue: 32 / 255 }; // #2a2520
const WHITE = { red: 1, green: 1, blue: 1 };

// Bordo bianco = grafico senza cornice visibile sul foglio.
const NO_BORDER = { colorStyle: { rgbColor: WHITE } };

const MONTHS_IT = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

const MONTHS_FULL = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const ALL = "Tutti"; // valore "nessun filtro" per Mese e Dipendente

type Sheets = ReturnType<typeof google.sheets>;

function getSheetsClient(config: { email: string; key: string }): Sheets {
  const auth = new google.auth.JWT({
    email: config.email,
    key: config.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function masterTabName(): string {
  return process.env.GOOGLE_SHEETS_TAB?.trim() || "Ore Totali";
}

/** Nome tab quotato per le formule (gestisce spazi e apici). */
function q(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

async function getSheetId(
  sheets: Sheets,
  spreadsheetId: string,
  title: string,
): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,sheetId)",
  });
  const found = meta.data.sheets?.find((s) => s.properties?.title === title);
  return found?.properties?.sheetId ?? null;
}

async function ensureTab(
  sheets: Sheets,
  spreadsheetId: string,
  title: string,
): Promise<number> {
  const existing = await getSheetId(sheets, spreadsheetId, title);
  if (existing != null) return existing;
  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  const id = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (id == null) throw new Error(`Impossibile creare il tab "${title}".`);
  return id;
}

/** Rimuove tutti i grafici già presenti su un tab (per re-run idempotenti). */
async function deleteChartsOnSheet(
  sheets: Sheets,
  spreadsheetId: string,
  sheetId: number,
): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties.sheetId,charts.chartId)",
  });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.sheetId === sheetId,
  );
  const chartIds = (sheet?.charts ?? [])
    .map((c) => c.chartId)
    .filter((id): id is number => id != null);
  if (chartIds.length === 0) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: chartIds.map((chartId) => ({
        deleteEmbeddedObject: { objectId: chartId },
      })),
    },
  });
}

function source(sheetId: number, col: number, endRow: number) {
  return {
    sourceRange: {
      sources: [
        {
          sheetId,
          startRowIndex: 0,
          endRowIndex: endRow,
          startColumnIndex: col,
          endColumnIndex: col + 1,
        },
      ],
    },
  };
}

function barChart(opts: {
  title: string;
  dataSheetId: number;
  labelCol: number;
  valueCol: number;
  endRow: number;
  color: { red: number; green: number; blue: number };
  anchor: { sheetId: number; row: number; col: number };
}) {
  return {
    addChart: {
      chart: {
        border: NO_BORDER,
        spec: {
          title: opts.title,
          titleTextFormat: { bold: true, fontSize: 12, foregroundColor: INK },
          backgroundColor: WHITE,
          basicChart: {
            chartType: "BAR",
            legendPosition: "NO_LEGEND",
            headerCount: 1,
            axis: [
              { position: "BOTTOM_AXIS", title: "Ore" },
              { position: "LEFT_AXIS" },
            ],
            domains: [
              {
                domain: source(opts.dataSheetId, opts.labelCol, opts.endRow),
              },
            ],
            series: [
              {
                series: source(opts.dataSheetId, opts.valueCol, opts.endRow),
                color: opts.color,
                targetAxis: "BOTTOM_AXIS",
              },
            ],
          },
        },
        position: {
          overlayPosition: {
            anchorCell: {
              sheetId: opts.anchor.sheetId,
              rowIndex: opts.anchor.row,
              columnIndex: opts.anchor.col,
            },
            widthPixels: 480,
            heightPixels: 320,
          },
        },
      },
    },
  };
}

function columnChart(opts: {
  title: string;
  dataSheetId: number;
  labelCol: number;
  valueCol: number;
  endRow: number;
  color: { red: number; green: number; blue: number };
  anchor: { sheetId: number; row: number; col: number };
}) {
  const c = barChart(opts) as ReturnType<typeof barChart>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (c.addChart.chart.spec as any).basicChart.chartType = "COLUMN";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (c.addChart.chart.spec as any).basicChart.axis = [
    { position: "BOTTOM_AXIS" },
    { position: "LEFT_AXIS", title: "Ore" },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (c.addChart.chart.spec as any).basicChart.series[0].targetAxis = "LEFT_AXIS";
  return c;
}

function pieChart(opts: {
  title: string;
  dataSheetId: number;
  labelCol: number;
  valueCol: number;
  endRow: number;
  anchor: { sheetId: number; row: number; col: number };
}) {
  return {
    addChart: {
      chart: {
        border: NO_BORDER,
        spec: {
          title: opts.title,
          titleTextFormat: { bold: true, fontSize: 12, foregroundColor: INK },
          backgroundColor: WHITE,
          pieChart: {
            legendPosition: "RIGHT_LEGEND",
            domain: source(opts.dataSheetId, opts.labelCol, opts.endRow),
            series: source(opts.dataSheetId, opts.valueCol, opts.endRow),
            pieHole: 0.45,
          },
        },
        position: {
          overlayPosition: {
            anchorCell: {
              sheetId: opts.anchor.sheetId,
              rowIndex: opts.anchor.row,
              columnIndex: opts.anchor.col,
            },
            widthPixels: 480,
            heightPixels: 320,
          },
        },
      },
    },
  };
}

function stackedColumnChart(opts: {
  title: string;
  dataSheetId: number;
  domainCol: number;
  seriesCols: number[];
  endRow: number;
  anchor: { sheetId: number; row: number; col: number };
  width?: number;
}) {
  return {
    addChart: {
      chart: {
        border: NO_BORDER,
        spec: {
          title: opts.title,
          titleTextFormat: { bold: true, fontSize: 12, foregroundColor: INK },
          backgroundColor: WHITE,
          basicChart: {
            chartType: "COLUMN",
            stackedType: "STACKED",
            legendPosition: "RIGHT_LEGEND",
            headerCount: 1,
            axis: [
              { position: "BOTTOM_AXIS" },
              { position: "LEFT_AXIS", title: "Ore" },
            ],
            domains: [
              { domain: source(opts.dataSheetId, opts.domainCol, opts.endRow) },
            ],
            series: opts.seriesCols.map((c) => ({
              series: source(opts.dataSheetId, c, opts.endRow),
              targetAxis: "LEFT_AXIS",
            })),
          },
        },
        position: {
          overlayPosition: {
            anchorCell: {
              sheetId: opts.anchor.sheetId,
              rowIndex: opts.anchor.row,
              columnIndex: opts.anchor.col,
            },
            widthPixels: opts.width ?? 980,
            heightPixels: 320,
          },
        },
      },
    },
  };
}

export async function applyStatisticheTab(): Promise<
  { ok: true; skipped?: boolean } | { ok: false; error: string }
> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  const creds = loadServiceAccountCredentials();
  if (!spreadsheetId || !creds.ok) {
    return { ok: true, skipped: true };
  }

  const sheets = getSheetsClient(creds);
  const M = q(masterTabName());
  const yearNow = new Date().getFullYear();

  try {
    // Separatore argomenti delle formule: dipende dal locale del foglio.
    // it_IT (e gli altri locale con la virgola come decimale) usano ";".
    const meta0 = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.locale",
    });
    const S = (meta0.data.properties?.locale ?? "").startsWith("en") ? "," : ";";

    const statsId = await ensureTab(sheets, spreadsheetId, STATS_TAB);
    const dataId = await ensureTab(sheets, spreadsheetId, DATA_TAB);

    // Clean slate (idempotente): via grafici e valori esistenti.
    await deleteChartsOnSheet(sheets, spreadsheetId, statsId);
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: [`${STATS_TAB}!A1:Z200`, `${DATA_TAB}!A1:AZ200`] },
    });

    // Il tab dati di default ha 26 colonne (A–Z): il pivot stagionalità usa
    // AA…AI. Allarga a 42 colonne (idempotente: cresce o resta).
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: dataId, gridProperties: { columnCount: 42 } },
              fields: "gridProperties.columnCount",
            },
          },
        ],
      },
    });

    // Celle filtro sul tab visibile.
    const YEAR = `${STATS_TAB}!$B$2`; // anno (numero)
    const EMP = `${STATS_TAB}!$B$4`; // dipendente ("Tutti" = tutti)
    // Helper nel tab nascosto:
    const MNUM = `${q(DATA_TAB)}!$T$1`; // mese selezionato come numero (0 = tutti)
    const EMPCRIT = `${q(DATA_TAB)}!$T$2`; // criterio dipendente per SUMIFS

    // Clausola WHERE dinamica condivisa da tutte le QUERY. Le virgole DENTRO la
    // stringa QUERY sono linguaggio QUERY; i separatori di argomenti usano S.
    // NB: in QUERY month() è 0-based (gennaio = 0) → uso MNUM-1.
    const whereClause =
      `"where K='Voce' and year(A) = "&${YEAR}` +
      `&IF(${MNUM}>0${S}" and month(A) = "&(${MNUM}-1)${S}"")` +
      `&IF(${EMP}="${ALL}"${S}""${S}" and B = '"&${EMP}&"'")`;

    // Stagionalità: solo Anno + Dipendente (mostra sempre tutti i mesi).
    const whereYE =
      `"where K='Voce' and year(A) = "&${YEAR}` +
      `&IF(${EMP}="${ALL}"${S}""${S}" and B = '"&${EMP}&"'")`;
    // Pivot mese (colonna I = 1° del mese) × settore (M). Spilla in AA:
    // col0 = mese, poi una colonna per settore (intestazione = nome settore).
    const stagionalitaPivot = `=IFERROR(QUERY(${M}!$A$2:$M${S} "select I, sum(E) "&${whereYE}&" group by I pivot M order by I"${S}0)${S}"")`;

    // NB: headers=0 (ultimo arg QUERY) è essenziale: con una sola riga dati
    // l'auto-detect la scambierebbe per intestazione → "Nessun dato".
    const groupQuery = (col: string, label: string) =>
      `=IFERROR(QUERY(${M}!$A$2:$M${S} "select ${col}, sum(E) "&${whereClause}&" group by ${col} order by sum(E) desc label ${col} '${label}', sum(E) 'Ore'"${S}0)${S}"Nessun dato")`;

    const lavorazioneQuery = groupQuery("F", "Lavorazione");
    const settoreQuery = groupQuery("M", "Settore");
    const luogoQuery = groupQuery("G", "Luogo");

    // Tabella riepilogo: ore totali, n° interventi (count), ore medie (avg).
    const summaryQuery = (col: string, label: string) =>
      `=IFERROR(QUERY(${M}!$A$2:$M${S} "select ${col}, sum(E), count(E), avg(E) "&${whereClause}&" group by ${col} order by sum(E) desc label ${col} '${label}', sum(E) 'Ore totali', count(E) 'Interventi', avg(E) 'Ore medie'"${S}0)${S}"Nessun dato")`;

    // Tab nascosto: formule che alimentano i grafici.
    //  A:B lavorazione · D:E settore · G:H luogo · J:K mesi · M anni · N dipendenti
    //  P:Q settore grezzo · R mesi · T helper (T1 mese#, T2 criterio dip.)
    // Il trend mensile rispetta Anno + Dipendente (non il filtro Mese: mostra
    // sempre tutti i 12 mesi dell'anno).
    const monthLabels = MONTHS_IT.map((m) => [m]);
    const monthValues = MONTHS_IT.map(
      (_, i) =>
        `=SUMIFS(${M}!$E$2:$E${S}${M}!$I$2:$I${S}DATE(${YEAR}${S}${i + 1}${S}1)${S}${M}!$K$2:$K${S}"Voce"${S}${M}!$B$2:$B${S}${EMPCRIT})`,
    );

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: `${DATA_TAB}!A1`, values: [[lavorazioneQuery]] },
          { range: `${DATA_TAB}!G1`, values: [[luogoQuery]] },
          // Settore: QUERY grezza in P:Q, poi D:E rietichetta il vuoto in
          // "Senza settore" così la legenda della torta mostra un testo.
          { range: `${DATA_TAB}!P1`, values: [[settoreQuery]] },
          { range: `${DATA_TAB}!D1:E1`, values: [["Settore", "Ore"]] },
          {
            range: `${DATA_TAB}!D2`,
            values: [
              [
                `=ARRAYFORMULA(IF(LEN(Q2:Q)${S}IF(P2:P=""${S}"Senza settore"${S}P2:P)${S}""))`,
              ],
            ],
          },
          {
            range: `${DATA_TAB}!E2`,
            values: [[`=ARRAYFORMULA(IF(LEN(Q2:Q)${S}Q2:Q${S}""))`]],
          },
          {
            range: `${DATA_TAB}!J1:K13`,
            values: [
              ["Mese", "Ore"],
              ...monthLabels.map((m, i) => [m[0], monthValues[i]]),
            ],
          },
          { range: `${DATA_TAB}!M1`, values: [["Anni"]] },
          {
            range: `${DATA_TAB}!M2`,
            values: [
              [
                `=IFERROR(SORT(UNIQUE(FILTER(YEAR(${M}!A2:A)${S}(${M}!A2:A<>"")*(${M}!K2:K="Voce")))${S}1${S}FALSE)${S}${yearNow})`,
              ],
            ],
          },
          // Lista dipendenti: "Tutti" + nomi distinti con voci.
          { range: `${DATA_TAB}!N1:N2`, values: [["Dipendenti"], [ALL]] },
          {
            range: `${DATA_TAB}!N3`,
            values: [
              [
                `=IFERROR(SORT(UNIQUE(FILTER(${M}!B2:B${S}(${M}!B2:B<>"")*(${M}!K2:K="Voce")))${S}1${S}TRUE)${S}"")`,
              ],
            ],
          },
          // Lista mesi per il menu: "Tutti" + Gennaio…Dicembre.
          {
            range: `${DATA_TAB}!R1:R14`,
            values: [["Mesi"], [ALL], ...MONTHS_FULL.map((m) => [m])],
          },
          // Helper: T1 = numero mese selezionato (0 = tutti) · T2 = criterio
          // dipendente per SUMIFS ("<>" = qualsiasi nome).
          {
            range: `${DATA_TAB}!T1`,
            values: [
              [
                `=IFERROR(MATCH(${STATS_TAB}!$B$3${S}$R$2:$R$14${S}0)-1${S}0)`,
              ],
            ],
          },
          {
            range: `${DATA_TAB}!T2`,
            values: [[`=IF(${STATS_TAB}!$B$4="${ALL}"${S}"<>"${S}${STATS_TAB}!$B$4)`]],
          },
          // Stagionalità: pivot mese × settore (colonne AA…).
          { range: `${DATA_TAB}!AA1`, values: [[stagionalitaPivot]] },
          // Etichette mese capitalizzate per l'asse ("Giu" invece di "giu",
          // che TEXT/"mmm" produrrebbe in locale italiano).
          { range: `${DATA_TAB}!AK1`, values: [["Mese"]] },
          {
            range: `${DATA_TAB}!AK2`,
            values: [
              [`=ARRAYFORMULA(IF(LEN(AA2:AA)${S}PROPER(TEXT(AA2:AA${S}"mmm"))${S}""))`],
            ],
          },
        ],
      },
    });

    // Tab visibile: titolo, selettore anno, KPI.
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          // Filtri (colonna A etichette, B menu a tendina).
          { range: `${STATS_TAB}!A2:B4`, values: [
            ["Anno", yearNow],
            ["Mese", ALL],
            ["Dipendente", ALL],
          ] },
          // KPI: etichette riga 6, valori riga 7.
          {
            range: `${STATS_TAB}!A6:E6`,
            values: [
              ["Ore totali", "", "Media mensile", "", "Dipendenti attivi"],
            ],
          },
          // Ore totali (filtrate per anno + mese + dipendente).
          {
            range: `${STATS_TAB}!A7`,
            values: [
              [
                `=IFERROR(SUM(QUERY(${M}!$A$2:$M${S} "select sum(E) "&${whereClause}&" label sum(E) ''"${S}0))${S}0)`,
              ],
            ],
          },
          // Media mensile = media dei mesi con ore (trend = anno + dipendente).
          {
            range: `${STATS_TAB}!C7`,
            values: [[`=IFERROR(AVERAGEIF(${q(DATA_TAB)}!$K$2:$K$13${S}">0")${S}0)`]],
          },
          // Dipendenti attivi (con i filtri attivi).
          {
            range: `${STATS_TAB}!E7`,
            values: [
              [
                `=IFERROR(COUNTUNIQUE(FILTER(${M}!B2:B${S}(${M}!K2:K="Voce")${S}(YEAR(${M}!A2:A)=${YEAR})${S}((${MNUM}=0)+(MONTH(${M}!A2:A)=${MNUM})>0)${S}((${EMP}="${ALL}")+(${M}!B2:B=${EMP})>0)))${S}0)`,
              ],
            ],
          },
          // Tabelle riepilogo (riga 61 titoli, 62 intestazioni QUERY).
          // Lavorazione A62:D + % in E · Luogo H62:K + % in L.
          { range: `${STATS_TAB}!A61`, values: [["Riepilogo per lavorazione"]] },
          {
            range: `${STATS_TAB}!A62`,
            values: [[summaryQuery("F", "Lavorazione")]],
          },
          { range: `${STATS_TAB}!E62`, values: [["%"]] },
          {
            range: `${STATS_TAB}!E63`,
            values: [
              [`=ARRAYFORMULA(IF(LEN($B$63:$B)${S}$B$63:$B/SUM($B$63:$B)${S}""))`],
            ],
          },
          { range: `${STATS_TAB}!H61`, values: [["Riepilogo per luogo"]] },
          {
            range: `${STATS_TAB}!H62`,
            values: [[summaryQuery("G", "Luogo")]],
          },
          { range: `${STATS_TAB}!L62`, values: [["%"]] },
          {
            range: `${STATS_TAB}!L63`,
            values: [
              [`=ARRAYFORMULA(IF(LEN($I$63:$I)${S}$I$63:$I/SUM($I$63:$I)${S}""))`],
            ],
          },
        ],
      },
    });

    // Formattazione + selettore a tendina + nascondi tab dati.
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Tutto bianco intorno: sfondo bianco sull'area + niente griglia.
          {
            updateSheetProperties: {
              properties: {
                sheetId: statsId,
                gridProperties: { hideGridlines: true },
              },
              fields: "gridProperties.hideGridlines",
            },
          },
          {
            repeatCell: {
              range: {
                sheetId: statsId,
                startRowIndex: 0,
                endRowIndex: 200,
                startColumnIndex: 0,
                endColumnIndex: 26,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: WHITE,
                  horizontalAlignment: "LEFT",
                },
              },
              fields:
                "userEnteredFormat(backgroundColor,horizontalAlignment)",
            },
          },
          // Cleanup banda titolo dei run precedenti: annulla il merge e
          // ripristina lo sfondo bianco sulla riga 1.
          {
            unmergeCells: {
              range: {
                sheetId: statsId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 11,
              },
            },
          },
          {
            repeatCell: {
              range: {
                sheetId: statsId,
                startRowIndex: 0,
                endRowIndex: 2,
                startColumnIndex: 0,
                endColumnIndex: 11,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: WHITE,
                  textFormat: { bold: false, foregroundColor: INK },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: statsId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 21 },
              fields: "pixelSize",
            },
          },
          // Etichette filtri (Anno/Mese/Dipendente) in grassetto.
          {
            repeatCell: {
              range: {
                sheetId: statsId,
                startRowIndex: 1,
                endRowIndex: 4,
                startColumnIndex: 0,
                endColumnIndex: 1,
              },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // Etichette KPI (riga 6) in terra.
          {
            repeatCell: {
              range: {
                sheetId: statsId,
                startRowIndex: 5,
                endRowIndex: 6,
                startColumnIndex: 0,
                endColumnIndex: 5,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, foregroundColor: TERRA },
                },
              },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // Valori KPI grandi (riga 7).
          {
            repeatCell: {
              range: {
                sheetId: statsId,
                startRowIndex: 6,
                endRowIndex: 7,
                startColumnIndex: 0,
                endColumnIndex: 5,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 18, foregroundColor: OLIVE },
                },
              },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // Titoli sezioni riepilogo (riga 61) in terra.
          {
            repeatCell: {
              range: { sheetId: statsId, startRowIndex: 60, endRowIndex: 61, startColumnIndex: 0, endColumnIndex: 12 },
              cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12, foregroundColor: TERRA } } },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // Intestazioni tabelle riepilogo (riga 62) in grassetto.
          {
            repeatCell: {
              range: { sheetId: statsId, startRowIndex: 61, endRowIndex: 62, startColumnIndex: 0, endColumnIndex: 12 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // Ore a 2 decimali, Interventi interi (B/D e I/K = ore, C/J = conteggi).
          ...[
            { c: 1, p: "0.00" }, // B Ore totali (lavorazione)
            { c: 2, p: "0" }, //    C Interventi
            { c: 3, p: "0.00" }, // D Ore medie
            { c: 8, p: "0.00" }, // I Ore totali (luogo)
            { c: 9, p: "0" }, //    J Interventi
            { c: 10, p: "0.00" }, // K Ore medie
          ].map(({ c, p }) => ({
            repeatCell: {
              range: { sheetId: statsId, startRowIndex: 62, endRowIndex: 200, startColumnIndex: c, endColumnIndex: c + 1 },
              cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: p } } },
              fields: "userEnteredFormat.numberFormat",
            },
          })),
          // Colonne % in formato percentuale.
          ...[4, 11].map((c) => ({
            repeatCell: {
              range: { sheetId: statsId, startRowIndex: 62, endRowIndex: 200, startColumnIndex: c, endColumnIndex: c + 1 },
              cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0%" } } },
              fields: "userEnteredFormat.numberFormat",
            },
          })),
          // Mese (colonna AA del tab dati) come "mmm" per l'asse stagionalità.
          {
            repeatCell: {
              range: { sheetId: dataId, startRowIndex: 0, endRowIndex: 50, startColumnIndex: 26, endColumnIndex: 27 },
              cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "mmm" } } },
              fields: "userEnteredFormat.numberFormat",
            },
          },
          // Menu a tendina: Anno (B2), Mese (B3), Dipendente (B4).
          ...[
            { row: 1, src: `=${q(DATA_TAB)}!$M$2:$M$50` },
            { row: 2, src: `=${q(DATA_TAB)}!$R$2:$R$14` },
            { row: 3, src: `=${q(DATA_TAB)}!$N$2:$N$50` },
          ].map(({ row, src }) => ({
            setDataValidation: {
              range: {
                sheetId: statsId,
                startRowIndex: row,
                endRowIndex: row + 1,
                startColumnIndex: 1,
                endColumnIndex: 2,
              },
              rule: {
                condition: {
                  type: "ONE_OF_RANGE",
                  values: [{ userEnteredValue: src }],
                },
                showCustomUi: true,
                strict: false,
              },
            },
          })),
          // Nessun colore tab + posiziona "Statistiche" come 2° foglio
          // (subito dopo "Ore Totali", indice 0). I campi tabColor* nel mask
          // senza valore azzerano il colore.
          {
            updateSheetProperties: {
              properties: { sheetId: statsId, index: 1 },
              fields: "index,tabColor,tabColorStyle",
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId: dataId, hidden: true },
              fields: "hidden",
            },
          },
        ],
      },
    });

    // Grafici (2×2). Sorgenti dal tab dati nascosto.
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          barChart({
            title: "Ore x Lavorazione",
            dataSheetId: dataId,
            labelCol: 0,
            valueCol: 1,
            endRow: 200,
            color: OLIVE,
            anchor: { sheetId: statsId, row: 9, col: 0 },
          }),
          pieChart({
            title: "Ore x Settore",
            dataSheetId: dataId,
            labelCol: 3,
            valueCol: 4,
            endRow: 200,
            anchor: { sheetId: statsId, row: 9, col: 7 },
          }),
          barChart({
            title: "Ore x Luogo",
            dataSheetId: dataId,
            labelCol: 6,
            valueCol: 7,
            endRow: 200,
            color: TERRA,
            anchor: { sheetId: statsId, row: 26, col: 0 },
          }),
          columnChart({
            title: "Ore x Mese",
            dataSheetId: dataId,
            labelCol: 9,
            valueCol: 10,
            endRow: 13,
            color: OLIVE,
            anchor: { sheetId: statsId, row: 26, col: 7 },
          }),
          stackedColumnChart({
            title: "Stagionalità (Mese × Settore)",
            dataSheetId: dataId,
            domainCol: 36, // AK = mese capitalizzato ("Giu")
            seriesCols: [27, 28, 29, 30, 31, 32, 33, 34], // AB…AI (max 8 settori)
            endRow: 50,
            anchor: { sheetId: statsId, row: 43, col: 0 },
            width: 980,
          }),
        ],
      },
    });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore sconosciuto",
    };
  }
}
