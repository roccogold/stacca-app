"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  availableYears,
  computeKpis,
  employeesWithEntries,
  filterEntries,
  hoursByDipendente,
  hoursByLavorazione,
  hoursByLuogo,
  type AnalisiEntry,
  type AnalisiUser,
  type Filters,
  type GroupRow,
} from "@/lib/analisi";
import { formatHoursIt, romeCalendarParts } from "@/lib/format";

const OLIVE = "#3d4a35"; // --stacca-olive
const TERRA = "#632e24"; // --stacca-terra
const INK = "#2a2520"; // --stacca-ink

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

const MAX_BARS = 12;

function ChartBars({ data, color }: { data: GroupRow[]; color: string }) {
  if (data.length === 0) {
    return <p className="analisi-empty">Nessun dato.</p>;
  }
  const rows = data.slice(0, MAX_BARS);
  const height = Math.max(120, rows.length * 38);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={rows}
        margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
        barCategoryGap={6}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={112}
          tick={{ fontSize: 12, fill: INK }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          formatter={(value) => [formatHoursIt(Number(value)), "Ore"]}
        />
        <Bar dataKey="hours" radius={[0, 6, 6, 0]} isAnimationActive={false}>
          {rows.map((row) => (
            <Cell key={row.label} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Kpi({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card analisi-kpi">
      <span className="analisi-kpi__num">{value}</span>
      <span className="analisi-kpi__label">{label}</span>
    </div>
  );
}

export function AnalisiClient({
  entries,
  users,
}: {
  entries: AnalisiEntry[];
  users: AnalisiUser[];
}) {
  const years = useMemo(() => availableYears(entries), [entries]);
  const employees = useMemo(
    () => employeesWithEntries(entries, users),
    [entries, users],
  );

  const [year, setYear] = useState<number>(years[0] ?? romeCalendarParts().y);
  const [month, setMonth] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const filters: Filters = { year, month, userId };
  const filtered = useMemo(
    () => filterEntries(entries, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, year, month, userId],
  );

  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const byLav = useMemo(() => hoursByLavorazione(filtered), [filtered]);
  const byLuogo = useMemo(() => hoursByLuogo(filtered), [filtered]);
  const byDip = useMemo(
    () => hoursByDipendente(filtered, users),
    [filtered, users],
  );

  const isEmpty = filtered.length === 0;

  return (
    <>
      <header className="page-header page-header--loose">
        <h1 className="h1">Analisi</h1>
      </header>

      <section className="block">
        <div className="analisi-filters">
          <select
            className="select"
            aria-label="Anno"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            className="select"
            aria-label="Mese"
            value={month ?? ""}
            onChange={(e) =>
              setMonth(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">Tutti i mesi</option>
            {MONTHS_FULL.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            className="select"
            aria-label="Dipendente"
            value={userId ?? ""}
            onChange={(e) =>
              setUserId(e.target.value === "" ? null : e.target.value)
            }
          >
            <option value="">Tutti i dipendenti</option>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="block">
        <div className="analisi-kpis">
          <Kpi value={formatHoursIt(kpis.oreTotali)} label="Ore totali" />
          <Kpi value={kpis.giorniLavorati} label="Giorni lavorati" />
          <Kpi
            value={formatHoursIt(kpis.mediaGiornaliera)}
            label="Media al giorno"
          />
          <Kpi value={kpis.dipendentiAttivi} label="Dipendenti attivi" />
        </div>
      </section>

      {isEmpty ? (
        <section className="block">
          <div className="card card--stats">
            <p className="analisi-empty">Nessun dato per questo periodo.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="block">
            <div className="card analisi-chart-card">
              <p className="card-title">Ore per Lavorazione</p>
              <ChartBars data={byLav} color={OLIVE} />
            </div>
          </section>

          <section className="block">
            <div className="card analisi-chart-card">
              <p className="card-title">Ore per Luogo</p>
              <ChartBars data={byLuogo} color={TERRA} />
            </div>
          </section>

          <section className="block">
            <div className="card analisi-chart-card">
              <p className="card-title">Ore per Dipendente</p>
              <ChartBars data={byDip} color={OLIVE} />
            </div>
          </section>
        </>
      )}
    </>
  );
}
