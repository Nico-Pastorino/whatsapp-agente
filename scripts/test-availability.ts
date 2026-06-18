/**
 * Tests del motor de disponibilidad (Fase 0 de la agenda profesional).
 * Correr con:  npx tsx scripts/test-availability.ts
 * No requiere DB ni red: valida la lógica pura de src/lib/availability.ts.
 */
import assert from "node:assert";
import {
  parseHHMM,
  minutesToHHMM,
  rangesOverlap,
  generateDaySlots,
  isSlotFree,
  getAvailableSlots,
} from "../src/lib/availability";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
  console.log("✓ " + msg);
};

ok(parseHHMM("08:00") === 480, "parse 08:00 = 480");
ok(parseHHMM("18:30") === 1110, "parse 18:30 = 1110");
ok(parseHHMM("25:00") === null, "parse inválido -> null");
ok(minutesToHHMM(1110) === "18:30", "format 1110 = 18:30");

ok(rangesOverlap(60, 120, 90, 150) === true, "overlap real");
ok(rangesOverlap(60, 120, 120, 180) === false, "tocarse no es overlap");

const s1 = generateDaySlots([{ open: "08:00", close: "12:00" }], 30, 30);
ok(s1.length === 8 && minutesToHHMM(s1[0]) === "08:00" && minutesToHHMM(s1[7]) === "11:30", "8 slots 08:00..11:30");
const s2 = generateDaySlots([{ open: "08:00", close: "12:00" }], 30, 60);
ok(minutesToHHMM(s2[s2.length - 1]) === "11:00", "duración 60 -> último 11:00 (entra completo)");
ok(generateDaySlots([{ open: "09:00", close: "10:00" }], 15, 15).length === 4, "cada 15 en 1h -> 4 slots");

ok(isSlotFree(600, 30, [{ startMin: 600, endMin: 630 }]) === false, "slot pisa turno tomado");
ok(isSlotFree(600, 30, [{ startMin: 630, endMin: 660 }]) === true, "slot pegado pero libre");
ok(isSlotFree(600, 30, [], [{ kind: "closed" }]) === false, "día cerrado -> no libre");
ok(isSlotFree(600, 30, [], [{ kind: "block", startMin: 590, endMin: 610 }]) === false, "bloqueo solapa");

const cfg = { slotIntervalMinutes: 30, defaultDurationMinutes: 30, leadMinutes: 0 };
const av = getAvailableSlots({ weekdayIntervals: [{ open: "08:00", close: "18:00" }], config: cfg, busy: [{ startMin: 600, endMin: 630 }] });
ok(!av.includes("10:00"), "10:00 ocupado no aparece");
ok(av.includes("09:00") && av.includes("17:30"), "horarios libres aparecen");
ok(getAvailableSlots({ weekdayIntervals: [{ open: "08:00", close: "18:00" }], config: cfg, exceptions: [{ kind: "closed" }] }).length === 0, "feriado -> 0 slots");
const sp = getAvailableSlots({ weekdayIntervals: [{ open: "08:00", close: "18:00" }], config: cfg, exceptions: [{ kind: "special", startMin: 540, endMin: 780 }] });
ok(sp[0] === "09:00" && sp[sp.length - 1] === "12:30", "horario especial 09-13 manda");
const lead = getAvailableSlots({ weekdayIntervals: [{ open: "08:00", close: "20:00" }], config: { ...cfg, leadMinutes: 120 }, nowMinutesIfToday: 16 * 60 });
ok(lead.every((t) => (parseHHMM(t) ?? 0) >= 18 * 60), "antelación 2h respeta el corte");
ok(getAvailableSlots({ weekdayIntervals: [], config: cfg }).length === 0, "sin horarios -> 0 slots (cae al modelo solicitud)");

console.log("\nTODOS OK: " + pass + " asserts");
