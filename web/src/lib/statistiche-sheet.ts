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
      requestBody: { ranges: [`${STATS_TAB}!A1:Z200`, `${DATA_TAB}!A1:Z200`] },
    });

    // Riferimento all'anno selezionato (cella B3 del tab Statistiche).
    const YEAR = `${STATS_TAB}!$B$3`;
    // NB: le virgole DENTRO la stringa QUERY (select…, label…) sono linguaggio
    // QUERY e restano virgole; solo i separatori di argomenti usano S.
    const range = (col: string) =>
      `${M}!$A$2:$M${S} "select ${col}, sum(E) where K='Voce' and A >= date '"&${YEAR}&"-01-01' and A <= date '"&${YEAR}&"-12-31' group by ${col} order by sum(E) desc`;

    const lavorazioneQuery = `=IFERROR(QUERY(${range("F")} label F 'Lavorazione', sum(E) 'Ore'")${S} "Nessun dato")`;
    const settoreQuery = `=IFERROR(QUERY(${range("M")} label M 'Settore', sum(E) 'Ore'")${S} "Nessun dato")`;
    const luogoQuery = `=IFERROR(QUERY(${range("G")} label G 'Luogo', sum(E) 'Ore'")${S} "Nessun dato")`;

    // Tab nascosto: formule che alimentano i grafici.
    //  A:B lavorazione · D:E settore · G:H luogo · J:K mesi · M lista anni
    const monthLabels = MONTHS_IT.map((m) => [m]);
    const monthValues = MONTHS_IT.map(
      (_, i) =>
        `=SUMIFS(${M}!$E$2:$E${S}${M}!$I$2:$I${S}DATE(${YEAR}${S}${i + 1}${S}1)${S}${M}!$K$2:$K${S}"Voce")`,
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
        ],
      },
    });

    // Tab visibile: titolo, selettore anno, KPI.
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: `${STATS_TAB}!A3`, values: [["Anno"]] },
          { range: `${STATS_TAB}!B3`, values: [[yearNow]] },
          {
            range: `${STATS_TAB}!A5:E5`,
            values: [
              ["Ore totali (anno)", "", "Media mensile", "", "Dipendenti attivi"],
            ],
          },
          {
            range: `${STATS_TAB}!A6`,
            values: [
              [
                `=SUMIFS(${M}!$E$2:$E${S}${M}!$A$2:$A${S}">="&DATE(${YEAR}${S}1${S}1)${S}${M}!$A$2:$A${S}"<="&DATE(${YEAR}${S}12${S}31)${S}${M}!$K$2:$K${S}"Voce")`,
              ],
            ],
          },
          {
            range: `${STATS_TAB}!C6`,
            values: [[`=IFERROR(AVERAGEIF(${q(DATA_TAB)}!$K$2:$K$13${S}">0")${S}0)`]],
          },
          {
            range: `${STATS_TAB}!E6`,
            values: [
              [
                `=IFERROR(COUNTUNIQUE(FILTER(${M}!B2:B${S}(${M}!K2:K="Voce")*(YEAR(${M}!A2:A)=${YEAR})))${S}0)`,
              ],
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
                endRowIndex: 80,
                startColumnIndex: 0,
                endColumnIndex: 26,
              },
              cell: { userEnteredFormat: { backgroundColor: WHITE } },
              fields: "userEnteredFormat.backgroundColor",
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
          // "Anno" label + KPI label in grassetto.
          {
            repeatCell: {
              range: {
                sheetId: statsId,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 0,
                endColumnIndex: 1,
              },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat",
            },
          },
          {
            repeatCell: {
              range: {
                sheetId: statsId,
                startRowIndex: 4,
                endRowIndex: 5,
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
          // Valori KPI grandi.
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
                  textFormat: { bold: true, fontSize: 18, foregroundColor: OLIVE },
                },
              },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // Menu a tendina Anno su B3.
          {
            setDataValidation: {
              range: {
                sheetId: statsId,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 1,
                endColumnIndex: 2,
              },
              rule: {
                condition: {
                  type: "ONE_OF_RANGE",
                  values: [
                    { userEnteredValue: `=${q(DATA_TAB)}!$M$2:$M$50` },
                  ],
                },
                showCustomUi: true,
                strict: false,
              },
            },
          },
          // Tab color olive + nascondi tab dati.
          {
            updateSheetProperties: {
              properties: { sheetId: statsId, tabColor: OLIVE },
              fields: "tabColor",
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
            title: "Ore per lavorazione",
            dataSheetId: dataId,
            labelCol: 0,
            valueCol: 1,
            endRow: 200,
            color: OLIVE,
            anchor: { sheetId: statsId, row: 7, col: 0 },
          }),
          pieChart({
            title: "Ore per settore",
            dataSheetId: dataId,
            labelCol: 3,
            valueCol: 4,
            endRow: 200,
            anchor: { sheetId: statsId, row: 7, col: 7 },
          }),
          barChart({
            title: "Ore per luogo",
            dataSheetId: dataId,
            labelCol: 6,
            valueCol: 7,
            endRow: 200,
            color: TERRA,
            anchor: { sheetId: statsId, row: 24, col: 0 },
          }),
          columnChart({
            title: "Ore per mese",
            dataSheetId: dataId,
            labelCol: 9,
            valueCol: 10,
            endRow: 13,
            color: OLIVE,
            anchor: { sheetId: statsId, row: 24, col: 7 },
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
