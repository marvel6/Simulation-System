/**
 * Fitness H(P) — lower is better.
 * Combines load imbalance (std/mean) with a small penalty for empty partitions
 * when the system overall has agents (Eq. 2.5 style objective).
 */
export function fitnessH(loads) {
    const counts = loads.map((l) => l.agentCount);
    const n = counts.length;
    if (n === 0)
        return 0;
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0)
        return 0;
    const mean = total / n;
    const variance = counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / n;
    const imbalance = Math.sqrt(variance) / Math.max(mean, 1);
    const emptyPenalty = total > 0 ? counts.filter((c) => c === 0).length / n : 0;
    return imbalance + 0.25 * emptyPenalty;
}
