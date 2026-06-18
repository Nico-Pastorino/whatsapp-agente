/**
 * Motor de disponibilidad de turnos — CAPA INDEPENDIENTE DE LA IA.
 *
 * Reglas de oro:
 *  - La IA nunca asume disponibilidad. Estas funciones (alimentadas con datos de
 *    Supabase por el worker / endpoints) son la ÚNICA fuente de verdad.
 *  - Funciones PURAS, sin acceso a DB ni a la red: 100% testeables en aislamiento.
 *
 * Todo el cálculo se hace en "minutos desde la medianoche" dentro de un día dado.
 * El manejo de zona horaria y de fechas reales vive en la capa que las consume
 * (que ya resuelve la fecha local del negocio antes de llamar acá).
 */

/** Intervalo de atención "HH:MM"–"HH:MM" (hora local del negocio). */
export interface TimeInterval {
  open: string; // "08:00"
  close: string; // "18:00"
}

export interface BookingConfig {
  /** Frecuencia de turnos en minutos (cada cuánto arranca un slot). */
  slotIntervalMinutes: number;
  /** Duración por defecto de un turno en minutos. */
  defaultDurationMinutes: number;
  /** Antelación mínima para reservar (minutos desde ahora). */
  leadMinutes: number;
}

/** Turno ya existente, expresado en minutos desde la medianoche del día evaluado. */
export interface BusyRange {
  startMin: number;
  endMin: number;
}

/** Excepción del día ya resuelta a minutos (closed/block/special). */
export interface DayException {
  kind: "closed" | "block" | "special";
  startMin?: number | null;
  endMin?: number | null;
}

const DAY_MIN = 24 * 60;

/** "HH:MM" -> minutos desde medianoche. Devuelve null si es inválido. */
export function parseHHMM(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutos -> "HH:MM" (con cero a la izquierda). */
export function minutesToHHMM(total: number): string {
  const t = ((total % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** ¿Se solapan [aStart,aEnd) y [bStart,bEnd)? (semiabiertos: tocarse NO es solapar). */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Genera los horarios de inicio candidatos de un día a partir de los intervalos
 * de atención, la frecuencia y la duración del turno. Un slot sólo es válido si
 * el turno COMPLETO (inicio + duración) entra dentro del intervalo.
 */
export function generateDaySlots(
  intervals: TimeInterval[],
  intervalMinutes: number,
  durationMinutes: number
): number[] {
  if (intervalMinutes <= 0 || durationMinutes <= 0) return [];
  const slots = new Set<number>();
  for (const interval of intervals) {
    const open = parseHHMM(interval.open);
    const close = parseHHMM(interval.close);
    if (open == null || close == null || close <= open) continue;
    for (let start = open; start + durationMinutes <= close; start += intervalMinutes) {
      slots.add(start);
    }
  }
  return Array.from(slots).sort((a, b) => a - b);
}

/**
 * ¿El slot [start, start+duration) está libre frente a turnos ocupados y bloqueos?
 */
export function isSlotFree(
  startMin: number,
  durationMinutes: number,
  busy: BusyRange[],
  exceptions: DayException[] = []
): boolean {
  const endMin = startMin + durationMinutes;

  // Cierre total del día.
  if (exceptions.some((e) => e.kind === "closed")) return false;

  // Bloqueos puntuales.
  for (const ex of exceptions) {
    if (ex.kind === "block" && ex.startMin != null && ex.endMin != null) {
      if (rangesOverlap(startMin, endMin, ex.startMin, ex.endMin)) return false;
    }
  }

  // Turnos ya tomados.
  for (const b of busy) {
    if (rangesOverlap(startMin, endMin, b.startMin, b.endMin)) return false;
  }
  return true;
}

export interface AvailabilityInput {
  /** Intervalos de atención del weekday (de business_hours). */
  weekdayIntervals: TimeInterval[];
  /** Excepciones del día (resueltas a minutos). 'special' reemplaza los intervalos. */
  exceptions?: DayException[];
  /** Turnos ya ocupados ese día, en minutos. */
  busy?: BusyRange[];
  config: BookingConfig;
  /** Si el día evaluado es HOY, minutos actuales para respetar la antelación. */
  nowMinutesIfToday?: number | null;
}

/**
 * Devuelve los horarios de inicio LIBRES del día como "HH:MM".
 * Aplica: horario (o 'special'), cierres, bloqueos, turnos tomados, antelación.
 */
export function getAvailableSlots(input: AvailabilityInput): string[] {
  const { config, exceptions = [], busy = [], nowMinutesIfToday = null } = input;
  const duration = config.defaultDurationMinutes;

  // Día cerrado por excepción → sin disponibilidad.
  if (exceptions.some((e) => e.kind === "closed")) return [];

  // 'special' reemplaza el horario normal del día.
  const specials = exceptions.filter(
    (e) => e.kind === "special" && e.startMin != null && e.endMin != null
  );
  const intervals: TimeInterval[] = specials.length
    ? specials.map((e) => ({ open: minutesToHHMM(e.startMin!), close: minutesToHHMM(e.endMin!) }))
    : input.weekdayIntervals;

  if (!intervals.length) return [];

  const candidates = generateDaySlots(intervals, config.slotIntervalMinutes, duration);
  const minStart =
    nowMinutesIfToday != null ? nowMinutesIfToday + Math.max(0, config.leadMinutes) : -1;

  return candidates
    .filter((start) => start >= minStart)
    .filter((start) => isSlotFree(start, duration, busy, exceptions))
    .map(minutesToHHMM);
}
