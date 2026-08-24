import { fitnessH as fitnessFromCounts } from "@crowd-sim/shared";
import type { PartitionLoad } from "./load-monitor.js";

/**
 * Fitness H(P) — lower is better (dissertation Eq. 2.5 style).
 */
export function fitnessH(loads: PartitionLoad[]): number {
  return fitnessFromCounts(loads.map((l) => l.agentCount));
}
