// Verdicts derived from measured values. The thresholds are fixed and shown to the user
// (WHY?> panel), so every grade can be traced back to the numbers that produced it.

export const GRADE_STEPS = [
  { grade: 'A+', ping: 20,  jitter: 5,  loss: 0.1 },
  { grade: 'A',  ping: 40,  jitter: 10, loss: 0.5 },
  { grade: 'B',  ping: 60,  jitter: 20, loss: 1 },
  { grade: 'C',  ping: 100, jitter: 30, loss: 2.5 },
  { grade: 'D',  ping: 150, jitter: 50, loss: 5 },
];

// The grade is the best step every known metric satisfies; unknown metrics are skipped.
export function gradeOf({ ping, jitter, loss }) {
  if (ping == null) return null;
  for (const step of GRADE_STEPS) {
    if (ping <= step.ping && (jitter == null || jitter <= step.jitter) && (loss == null || loss <= step.loss)) {
      return step.grade;
    }
  }
  return 'F';
}

// 100 minus penalties for jitter, loss and late packets.
export const STABILITY_WEIGHTS = { jitter: 4, loss: 15, late: 3 };

export function stabilityOf({ jitter, loss, late }) {
  if (jitter == null && loss == null) return null;
  const w = STABILITY_WEIGHTS;
  const score = 100 - w.jitter * (jitter ?? 0) - w.loss * (loss ?? 0) - w.late * (late ?? 0);
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function stabilityWord(score) {
  if (score == null) return null;
  if (score >= 80) return 'STABLE';
  if (score >= 50) return 'FAIR';
  return 'UNSTABLE';
}

export function speedWord(mbps) {
  if (mbps == null) return null;
  if (mbps >= 250) return 'VERY FAST';
  if (mbps >= 100) return 'FAST';
  if (mbps >= 25) return 'GOOD';
  if (mbps >= 10) return 'FAIR';
  return 'SLOW';
}

export function pingWord(ms) {
  if (ms == null) return null;
  if (ms <= 20) return 'EXCELLENT';
  if (ms <= 50) return 'GOOD';
  if (ms <= 100) return 'FAIR';
  return 'POOR';
}

// "||||||··" — filled count proportional to the score, out of 8.
export function ticks(score) {
  const filled = score == null ? 0 : Math.round(score / 12.5);
  return '|'.repeat(filled) + '·'.repeat(8 - filled);
}
