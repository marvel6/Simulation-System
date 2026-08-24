export function fitnessH(agentCounts) {
    const n = agentCounts.length;
    if (n === 0)
        return 0;
    const total = agentCounts.reduce((a, b) => a + b, 0);
    if (total === 0)
        return 0;
    const mean = total / n;
    const variance = agentCounts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / n;
    const imbalance = Math.sqrt(variance) / Math.max(mean, 1);
    const emptyPenalty = total > 0 ? agentCounts.filter((c) => c === 0).length / n : 0;
    return imbalance + 0.25 * emptyPenalty;
}
