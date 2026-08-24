import type { PartitionLoad } from "./load-monitor.js";
/**
 * Fitness H(P) — lower is better (dissertation Eq. 2.5 style).
 */
export declare function fitnessH(loads: PartitionLoad[]): number;
