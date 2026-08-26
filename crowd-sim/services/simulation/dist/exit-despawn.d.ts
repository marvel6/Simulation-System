import type { Agent } from "@crowd-sim/shared";
/**
 * Remove agents that have reached their exit. Prevents permanent pile-up on
 * the last partition so later agents can still migrate through.
 */
export declare function despawnArrivedAgents(agents: Map<string, Agent>): number;
