"use client";

import { Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BREAK_PRESETS, HOUR_CHIPS } from "@/lib/constants";
import {
  defaultTimesFromHours,
  formatBreakMinutesIt,
  formatHoursIt,
  hoursFromTimeRange,
  isValidWorkHours,
  stepBreakMinutes,
  stepHoursByMinutes,
  workedMinutesFromTimeRange,
} from "@/lib/format";

type Props = {
  hours: number;
  onHoursChange: (h: number) => void;
  disabled?: boolean;
  /** Pre-filled hours when editing (no stored start/end). */
  initialHours?: number;
};

export function HoursEntryCard({
  hours,
  onHoursChange,
  disabled = false,
  initialHours,
}: Props) {
  const seed = initialHours && initialHours > 0 ? initialHours : 0;
  const defaults = seed > 0 ? defaultTimesFromHours(seed) : { start: "", end: "", breakMinutes: 0 };

  const [manualMode, setManualMode] = useState(false);
  const [startTime, setStartTime] = useState(defaults.start);
  const [endTime, setEndTime] = useState(defaults.end);
  const [breakMinutes, setBreakMinutes] = useState(defaults.breakMinutes);

  const spanMinutes = useMemo(
    () => workedMinutesFromTimeRange(startTime, endTime, 0),
    [startTime, endTime],
  );

  const maxBreakMinutes = useMemo(() => {
    if (spanMinutes === null || spanMinutes <= 1) return 0;
    return spanMinutes - 1;
  }, [spanMinutes]);

  const computedHours = useMemo(
    () => hoursFromTimeRange(startTime, endTime, breakMinutes),
    [startTime, endTime, breakMinutes],
  );

  useEffect(() => {
    if (manualMode || breakMinutes <= maxBreakMinutes) return;
    applyBreak(maxBreakMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp when inizio/fine shrink span
  }, [maxBreakMinutes, manualMode]);

  const timeError = useMemo(() => {
    if (manualMode) return null;
    if (!startTime.trim() || !endTime.trim()) return null;
    if (computedHours !== null && isValidWorkHours(computedHours)) return null;
    if (breakMinutes > 0 && computedHours === null) return "La pausa è troppo lunga";
    return "La fine deve essere dopo l'inizio";
  }, [manualMode, startTime, endTime, computedHours, breakMinutes]);

  function syncHoursFromTimes(start: string, end: string, pause: number) {
    const h = hoursFromTimeRange(start, end, pause);
    onHoursChange(h != null && h > 0 ? h : 0);
  }

  function handleStartChange(v: string) {
    setStartTime(v);
    syncHoursFromTimes(v, endTime, breakMinutes);
  }

  function handleEndChange(v: string) {
    setEndTime(v);
    syncHoursFromTimes(startTime, v, breakMinutes);
  }

  function applyBreak(min: number) {
    const capped = Math.min(maxBreakMinutes, Math.max(0, min));
    setBreakMinutes(capped);
    syncHoursFromTimes(startTime, endTime, capped);
  }

  function handleBreakStep(delta: number) {
    applyBreak(stepBreakMinutes(breakMinutes, delta, maxBreakMinutes));
  }

  const displayHours = manualMode ? hours : (computedHours ?? 0);

  return (
    <div className="field field--orario">
      <div className="field-label-row">
        <span className="field-label field-label--plain">
          {manualMode ? "Ore" : "Orario"}
        </span>
        {!disabled && (
          <button
            type="button"
            className="field-label-row__link"
            onClick={() => {
              if (manualMode) {
                setManualMode(false);
                const h = hoursFromTimeRange(startTime, endTime, breakMinutes);
                if (h != null && h > 0) onHoursChange(h);
              } else {
                if (computedHours != null && computedHours > 0) {
                  onHoursChange(computedHours);
                }
                setManualMode(true);
              }
            }}
          >
            {manualMode ? "Usa inizio e fine" : "Solo le ore"}
          </button>
        )}
      </div>

      {!manualMode ? (
        <div className="orario-card">
          <div className="orario-card__grid">
            <div className="orario-card__field">
              <label className="orario-card__label" htmlFor="ora-inizio">
                Inizio
              </label>
              <div className="time-slot">
                <input
                  id="ora-inizio"
                  type="time"
                  step={60}
                  className="time-slot__input"
                  value={startTime}
                  onChange={(e) => handleStartChange(e.target.value)}
                  disabled={disabled}
                />
                <Clock size={18} className="time-slot__icon" aria-hidden />
              </div>
            </div>
            <div className="orario-card__field">
              <label className="orario-card__label" htmlFor="ora-fine">
                Fine
              </label>
              <div className="time-slot">
                <input
                  id="ora-fine"
                  type="time"
                  step={60}
                  className="time-slot__input"
                  value={endTime}
                  onChange={(e) => handleEndChange(e.target.value)}
                  disabled={disabled}
                />
                <Clock size={18} className="time-slot__icon" aria-hidden />
              </div>
            </div>
          </div>

          <div className="orario-card__field orario-card__field--break">
            <span className="orario-card__label">Pausa</span>
            <div className="pausa-stepper">
              <button
                type="button"
                className="pausa-stepper__btn"
                aria-label="Riduci pausa di un minuto"
                onClick={() => handleBreakStep(-1)}
                disabled={disabled || breakMinutes <= 0}
              >
                −
              </button>
              <span className="pausa-stepper__value" aria-live="polite">
                {formatBreakMinutesIt(breakMinutes)}
              </span>
              <button
                type="button"
                className="pausa-stepper__btn"
                aria-label="Aumenta pausa di un minuto"
                onClick={() => handleBreakStep(1)}
                disabled={disabled || breakMinutes >= maxBreakMinutes}
              >
                +
              </button>
            </div>
            <div className="pausa-presets" role="group" aria-label="Pausa rapida">
              {BREAK_PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  type="button"
                  className={`pausa-presets__btn${
                    breakMinutes === p.minutes ? " pausa-presets__btn--active" : ""
                  }`}
                  onClick={() => applyBreak(p.minutes)}
                  disabled={disabled || p.minutes > maxBreakMinutes}
                  aria-pressed={breakMinutes === p.minutes}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="orario-card__footer" aria-live="polite">
            <span className="orario-card__total-label">Totale</span>
            <span className="orario-card__total-value">{formatHoursIt(displayHours)}</span>
          </div>

          {timeError && displayHours <= 0 && (
            <p className="form-hint form-hint--tight form-hint--warn orario-card__error">
              {timeError}
            </p>
          )}
        </div>
      ) : (
        <div className="stepper-card">
          <div className="stepper">
            <button
              type="button"
              className="stepper__btn"
              aria-label="Diminuisci di un minuto"
              onClick={() => onHoursChange(stepHoursByMinutes(hours, -1))}
              disabled={disabled}
            >
              −
            </button>
            <div className="stepper__value">
              <span className="stepper__num stepper__num--duration">{formatHoursIt(hours)}</span>
            </div>
            <button
              type="button"
              className="stepper__btn"
              aria-label="Aumenta di un minuto"
              onClick={() => onHoursChange(stepHoursByMinutes(hours, 1))}
              disabled={disabled}
            >
              +
            </button>
          </div>
          <p className="form-hint form-hint--tight">Usa +/− minuto per minuto</p>
          <div className="chips chips--pills">
            {HOUR_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip chip--pill${Math.abs(hours - c) < 0.001 ? " chip--active" : ""}`}
                onClick={() => onHoursChange(c)}
                disabled={disabled}
                aria-label={formatHoursIt(c)}
              >
                {formatHoursIt(c)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
