"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Briefcase, Calendar, Users } from "lucide-react";
import {
  Bar,
  type BarRectangleItem,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Rectangle,
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
  hoursBySettore,
  monthlyTrend,
  MONTHS_SHORT,
  seasonalityByMonthSettore,
  SETTORE_COLORS,
  type AnalisiEntry,
  type AnalisiUser,
  type GroupRow,
  type Seasonality,
} from "@/lib/analisi";
import { formatHoursIt, romeCalendarParts } from "@/lib/format";
import { AnalisiChat } from "@/components/AnalisiChat";

const OLIVE = "#3d4a35"; // --stacca-olive
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

const COLLAPSE_LIMIT = 5; // liste riepilogo: top 5, poi toggle "Mostra tutte"
const BAR_SIZE = 26; // barre slanciate = look più leggero

type TipItem = { name?: string | number; value?: number | string; color?: string };

/** Tooltip morbido e coerente per tutti i grafici (arrotondato, con ombra). */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const title =
    label != null && label !== "" ? String(label) : String(payload[0].name ?? "");
  const rows = payload.filter((p) => Number(p.value) > 0);
  const multi = rows.length > 1;
  return (
    <div className="analisi-tip">
      <div className="analisi-tip__title">{title}</div>
      {multi ? (
        rows.map((p) => (
          <div key={String(p.name)} className="analisi-tip__row">
            <span
              className="analisi-tip__dot"
              style={{ background: p.color ?? OLIVE }}
            />
            <span className="analisi-tip__name">{p.name}</span>
            <span className="analisi-tip__rowval">
              {formatHoursIt(Number(p.value))}
            </span>
          </div>
        ))
      ) : (
        <div className="analisi-tip__val">
          {formatHoursIt(Number((rows[0] ?? payload[0]).value))}
        </div>
      )}
    </div>
  );
}

function DonutChart({ data }: { data: GroupRow[] }) {
  if (data.length === 0) return <p className="analisi-empty">Nessun dato.</p>;
  const rows = data.slice(0, 8);
  const total = rows.reduce((s, r) => s + r.hours, 0);
  return (
    <>
      <div className="analisi-donut">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={rows}
              dataKey="hours"
              nameKey="label"
              innerRadius={62}
              outerRadius={96}
              paddingAngle={0}
              cornerRadius={0}
              stroke="var(--card)"
              strokeWidth={2}
              animationDuration={300}
              animationEasing="ease-out"
            >
              {rows.map((row, i) => (
                <Cell
                  key={row.label}
                  fill={SETTORE_COLORS[i % SETTORE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} animationDuration={200} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="analisi-legend">
        {rows.map((row, i) => {
          const pct = total ? Math.round((row.hours / total) * 100) : 0;
          return (
            <li key={row.label} className="analisi-legend__item">
              <span
                className="analisi-legend__dot"
                style={{ background: SETTORE_COLORS[i % SETTORE_COLORS.length] }}
              />
              <span className="analisi-legend__label">{row.label}</span>
              <span className="analisi-legend__pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function TrendChart({ data }: { data: { label: string; hours: number }[] }) {
  const gradId = useId().replace(/:/g, "");
  if (!data.some((d) => d.hours > 0)) {
    return <p className="analisi-empty">Nessun dato.</p>;
  }
  // Mese di picco evidenziato; gli altri leggermente più tenui.
  const peak = data.reduce((m, d) => Math.max(m, d.hours), 0);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--olive) 78%, white)" />
            <stop offset="100%" stopColor="var(--olive)" />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          interval={0}
          tick={{ fontSize: 11, fill: INK }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          width={32}
          tick={{ fontSize: 11, fill: INK }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          content={<ChartTooltip />}
          animationDuration={200}
        />
        <Bar
          dataKey="hours"
          fill={`url(#${gradId})`}
          radius={[10, 10, 0, 0]}
          maxBarSize={BAR_SIZE}
          animationDuration={250}
          animationEasing="ease-out"
        >
          {data.map((d) => (
            <Cell
              key={d.label}
              fillOpacity={peak > 0 && d.hours === peak ? 1 : 0.55}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Shape per le barre impilate: arrotonda solo il segmento più in alto
 * effettivamente presente in quel mese (l'ultima serie spesso è 0, quindi
 * il top "vero" cambia per colonna). `idx` = posizione della serie nello stack.
 */
function stackTopShape(settori: string[], idx: number) {
  return function StackBar(props: BarRectangleItem) {
    const payload = props.payload as Record<string, number | string> | undefined;
    const isTop = settori
      .slice(idx + 1)
      .every((s) => Number(payload?.[s] ?? 0) <= 0);
    return <Rectangle {...props} radius={isTop ? [8, 8, 0, 0] : 0} />;
  };
}

function StackedChart({ data, settori }: Seasonality) {
  const hasData =
    settori.length > 0 &&
    data.some((row) => settori.some((s) => Number(row[s]) > 0));
  if (!hasData) return <p className="analisi-empty">Nessun dato.</p>;
  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
          <XAxis
            dataKey="mese"
            interval={0}
            tick={{ fontSize: 11, fill: INK }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={32}
            tick={{ fontSize: 11, fill: INK }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} animationDuration={200} />
          {settori.map((s, i) => (
            <Bar
              key={s}
              dataKey={s}
              stackId="a"
              fill={SETTORE_COLORS[i % SETTORE_COLORS.length]}
              stroke="var(--card)"
              strokeWidth={1}
              maxBarSize={BAR_SIZE}
              shape={stackTopShape(settori, i)}
              animationDuration={250}
              animationEasing="ease-out"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ul className="analisi-legend">
        {settori.map((s, i) => (
          <li key={s} className="analisi-legend__item">
            <span
              className="analisi-legend__dot"
              style={{ background: SETTORE_COLORS[i % SETTORE_COLORS.length] }}
            />
            {s}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Andamento mensile per settore: una linea per area → picchi/stagionalità. */
function SettoreLinesChart({ data, settori }: Seasonality) {
  const hasData =
    settori.length > 0 &&
    data.some((row) => settori.some((s) => Number(row[s]) > 0));
  if (!hasData) return <p className="analisi-empty">Nessun dato.</p>;
  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="mese"
            interval={0}
            tick={{ fontSize: 11, fill: INK }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={32}
            tick={{ fontSize: 11, fill: INK }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} animationDuration={200} />
          {settori.map((s, i) => {
            const color = SETTORE_COLORS[i % SETTORE_COLORS.length];
            return (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 2.5, strokeWidth: 0, fill: color }}
                activeDot={{ r: 4 }}
                animationDuration={300}
                animationEasing="ease-out"
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
      <ul className="analisi-legend">
        {settori.map((s, i) => (
          <li key={s} className="analisi-legend__item">
            <span
              className="analisi-legend__dot"
              style={{ background: SETTORE_COLORS[i % SETTORE_COLORS.length] }}
            />
            {s}
          </li>
        ))}
      </ul>
    </>
  );
}

function RiepilogoList({ rows }: { rows: GroupRow[] }) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return <p className="analisi-empty">Nessun dato.</p>;
  const total = rows.reduce((s, r) => s + r.hours, 0);
  // Oltre 5 voci la lista diventa lunghissima: mostra le top 5 + toggle "espandi".
  const collapsible = rows.length > COLLAPSE_LIMIT;
  const visible = expanded ? rows : rows.slice(0, COLLAPSE_LIMIT);
  return (
    <>
      <ul className="analisi-riepilogo">
        {visible.map((r) => {
          const pct = total ? Math.round((r.hours / total) * 100) : 0;
          return (
            <li key={r.label} className="analisi-riepilogo__row">
              <div className="analisi-riepilogo__top">
                <span className="analisi-riepilogo__label">{r.label}</span>
                <span className="analisi-riepilogo__hours">
                  {formatHoursIt(r.hours)}
                </span>
              </div>
              <div className="analisi-riepilogo__bar">
                <div
                  className="analisi-riepilogo__bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="analisi-riepilogo__meta">
                {r.count} {r.count === 1 ? "registrazione" : "registrazioni"} ·
                media{" "}
                {formatHoursIt(r.avg)} · {pct}%
              </div>
            </li>
          );
        })}
      </ul>
      {collapsible ? (
        <button
          type="button"
          className="analisi-expand"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Mostra meno" : `Mostra tutte (${rows.length})`}
        </button>
      ) : null}
    </>
  );
}

function NumKpi({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card analisi-kpi">
      <span className="analisi-kpi__num">{value}</span>
      <span className="analisi-kpi__label">{label}</span>
    </div>
  );
}

function TopKpi({
  cap,
  row,
  total,
}: {
  cap: string;
  row: GroupRow | undefined;
  total: number;
}) {
  if (!row) {
    return (
      <div className="card analisi-kpi">
        <span className="analisi-kpi__cap">{cap}</span>
        <span className="analisi-kpi__name">—</span>
      </div>
    );
  }
  const pct = total ? Math.round((row.hours / total) * 100) : 0;
  return (
    <div className="card analisi-kpi">
      <span className="analisi-kpi__cap">{cap}</span>
      <span className="analisi-kpi__name">{row.label}</span>
      <span className="analisi-kpi__sub">
        {formatHoursIt(row.hours)} · {pct}%
      </span>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="block">
      <div className="card analisi-chart-card">
        <p className="card-title">
          {title}
          {hint ? <span className="analisi-hint"> · {hint}</span> : null}
        </p>
        {children}
      </div>
    </section>
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
  // Settori presenti (ordinati per ore desc), per il menu di filtro.
  const settori = useMemo(
    () => hoursBySettore(entries).map((r) => r.label),
    [entries],
  );

  const [year, setYear] = useState<number>(years[0] ?? romeCalendarParts().y);
  const [month, setMonth] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [settore, setSettore] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterEntries(entries, { year, month, userId, settore }),
    [entries, year, month, userId, settore],
  );
  // Trend e stagionalità: anno + dipendente + settore, senza filtro mese.
  const filteredYear = useMemo(
    () => filterEntries(entries, { year, month: null, userId, settore }),
    [entries, year, userId, settore],
  );

  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const byLav = useMemo(() => hoursByLavorazione(filtered), [filtered]);
  const byLuogo = useMemo(() => hoursByLuogo(filtered), [filtered]);
  const byDip = useMemo(
    () => hoursByDipendente(filtered, users),
    [filtered, users],
  );
  const bySettore = useMemo(() => hoursBySettore(filtered), [filtered]);
  const trend = useMemo(() => monthlyTrend(filteredYear), [filteredYear]);
  const stagionalita = useMemo(
    () => seasonalityByMonthSettore(filteredYear),
    [filteredYear],
  );

  // Variazione % vs periodo precedente (mese prec. o anno prec.).
  const deltaPct = useMemo(() => {
    const prev =
      month == null
        ? { year: year - 1, month: null }
        : month === 1
          ? { year: year - 1, month: 12 }
          : { year, month: month - 1 };
    const prevTot = filterEntries(entries, { ...prev, userId, settore }).reduce(
      (s, e) => s + e.hours,
      0,
    );
    if (prevTot <= 0) return null;
    return Math.round(((kpis.oreTotali - prevTot) / prevTot) * 100);
  }, [entries, year, month, userId, settore, kpis.oreTotali]);

  const isEmptyYear = filteredYear.length === 0;
  const monthName = month != null ? MONTHS_FULL[month - 1] : null;

  return (
    <>
      <header className="page-header page-header--loose">
        <h1 className="h1">Analisi</h1>
      </header>

      <AnalisiChat users={employees} />

      <section className="block">
        <div className="analisi-filters">
          <label className="analisi-filter">
            <Calendar className="analisi-filter__icon" size={18} aria-hidden />
            <select
              className="select analisi-filter__select"
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
          </label>

          <label className="analisi-filter">
            <Users className="analisi-filter__icon" size={18} aria-hidden />
            <select
              className="select analisi-filter__select"
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
          </label>

          <label className="analisi-filter">
            <Briefcase className="analisi-filter__icon" size={18} aria-hidden />
            <select
              className="select analisi-filter__select"
              aria-label="Settore"
              value={settore ?? ""}
              onChange={(e) =>
                setSettore(e.target.value === "" ? null : e.target.value)
              }
            >
              <option value="">Tutti i settori</option>
              {settori.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="analisi-pills" role="tablist" aria-label="Periodo">
          <button
            type="button"
            role="tab"
            aria-selected={month == null}
            className={`analisi-pill${month == null ? " analisi-pill--active" : ""}`}
            onClick={() => setMonth(null)}
          >
            Anno
          </button>
          {MONTHS_SHORT.map((name, i) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={month === i + 1}
              className={`analisi-pill${month === i + 1 ? " analisi-pill--active" : ""}`}
              onClick={() => setMonth(i + 1)}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      {/* Hero: ore totali + variazione */}
      <section className="block">
        <div className="card analisi-hero">
          <span className="analisi-hero__cap">
            Ore totali{monthName ? ` · ${monthName}` : " · anno"}
          </span>
          <div className="analisi-hero__row">
            <span className="analisi-hero__num">
              {formatHoursIt(kpis.oreTotali)}
            </span>
            {deltaPct != null ? (
              <span
                className={`analisi-delta ${
                  deltaPct >= 0 ? "analisi-delta--up" : "analisi-delta--down"
                }`}
              >
                {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct)}%
                <span className="analisi-delta__cmp">
                  {month != null ? "vs mese precedente" : "vs anno precedente"}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {!isEmptyYear ? (
        <section className="block">
          <div className="analisi-kpis">
            <TopKpi cap="Lavorazione top" row={byLav[0]} total={kpis.oreTotali} />
            <TopKpi cap="Luogo top" row={byLuogo[0]} total={kpis.oreTotali} />
            <NumKpi
              value={formatHoursIt(kpis.mediaIntervento)}
              label="Ore medie / registrazione"
            />
            <NumKpi value={kpis.numInterventi} label="Registrazioni" />
          </div>
        </section>
      ) : null}

      {isEmptyYear ? (
        <section className="block">
          <div className="card card--stats">
            <p className="analisi-empty">Nessun dato per questo periodo.</p>
          </div>
        </section>
      ) : (
        <>
          <ChartCard title="Ore per Lavorazione" hint={monthName ?? undefined}>
            <RiepilogoList rows={byLav} />
          </ChartCard>

          <ChartCard title="Ore per Luogo" hint={monthName ?? undefined}>
            <RiepilogoList rows={byLuogo} />
          </ChartCard>

          <ChartCard title="Ore per Dipendente" hint={monthName ?? undefined}>
            <RiepilogoList rows={byDip} />
          </ChartCard>

          <ChartCard title="Ore per Settore" hint={monthName ?? undefined}>
            <DonutChart data={bySettore} />
          </ChartCard>

          <ChartCard title="Ore per Mese" hint="anno intero">
            <TrendChart data={trend} />
          </ChartCard>

          <ChartCard title="Stagionalità (Mese × Settore)" hint="anno intero">
            <StackedChart data={stagionalita.data} settori={stagionalita.settori} />
          </ChartCard>

          <ChartCard title="Andamento per Settore" hint="anno intero">
            <SettoreLinesChart
              data={stagionalita.data}
              settori={stagionalita.settori}
            />
          </ChartCard>
        </>
      )}
    </>
  );
}
