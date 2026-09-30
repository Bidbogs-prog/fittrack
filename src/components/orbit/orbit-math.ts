/**
 * Pure dial geometry for the orbit (viewBox 0 0 240 240, centre 120,120).
 * Deliberately not a client module: server components call these too, and
 * a function imported from a "use client" file is only a reference there.
 */

export const C = (r: number) => 2 * Math.PI * r;

export function dash(fraction: number, r: number): string {
  const f = Math.max(0, Math.min(fraction, 1));
  return `${f * C(r)} ${C(r)}`;
}

/** Point on the dial for a minute-of-day, clockwise from 00 at the top. */
export function pointAt(minutes: number, r: number): { x: number; y: number } {
  const a = ((minutes / 1440) * 360 * Math.PI) / 180;
  return { x: 120 + r * Math.sin(a), y: 120 - r * Math.cos(a) };
}

export interface OrbitWindow {
  startMin: number;
  endMin: number;
}

export function windowArc(win: OrbitWindow): { length: number; rotate: number } {
  const span = (((win.endMin - win.startMin) % 1440) + 1440) % 1440 || 1440;
  return {
    length: (span / 1440) * C(106),
    rotate: (win.startMin / 1440) * 360 - 90,
  };
}

/** Colour for a logged day: flame on target, flame-deep over, muted under. */
export function dayColor(ratio: number | null): string {
  if (ratio == null) return "var(--ink-700)";
  if (ratio > 1.05) return "var(--flame-deep)";
  if (ratio < 0.9) return "var(--paper-mute)";
  return "var(--flame)";
}
