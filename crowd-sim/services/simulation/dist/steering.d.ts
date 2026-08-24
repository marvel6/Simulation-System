import type { Agent } from "@crowd-sim/shared";
/** Simulation timestep in seconds (matches 100ms tick). */
export declare const DT = 0.1;
/**
 * Helbing-style Social Force Model (dissertation §2.3.1):
 *   F = F_desired + Σ F_repulsive(neighbors)
 * Acceleration updates velocity, then position.
 */
export declare function updateAgentPosition(agent: Agent, neighbors: Agent[]): void;
