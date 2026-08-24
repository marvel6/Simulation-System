import type { PartitionLoad } from "./load-monitor.js";
/**
 * Fitness H(P) — lower is better.
 * Combines load imbalance (std/mean) with a small penalty for empty partitions
 * when the system overall has agents (Eq. 2.5 style objective).
 */
export declare function fitnessH(loads: PartitionLoad[]): number;
