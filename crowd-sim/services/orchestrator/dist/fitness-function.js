import { fitnessH as fitnessFromCounts } from "@crowd-sim/shared";
/**
 * Fitness H(P) — lower is better (dissertation Eq. 2.5 style).
 */
export function fitnessH(loads) {
    return fitnessFromCounts(loads.map((l) => l.agentCount));
}
