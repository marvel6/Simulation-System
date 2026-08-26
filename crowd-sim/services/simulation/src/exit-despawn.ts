import type { Agent } from "@crowd-sim/shared";

/** Distance to goal at which an agent is treated as escaped (scenario exitProximity). */
const EXIT_PROXIMITY = Number(process.env.EXIT_PROXIMITY ?? 40);

/**
 * Remove agents that have reached their exit. Prevents permanent pile-up on
 * the last partition so later agents can still migrate through.
 */
export function despawnArrivedAgents(agents: Map<string, Agent>): number {
  const threshold =
    Number.isFinite(EXIT_PROXIMITY) && EXIT_PROXIMITY > 0 ? EXIT_PROXIMITY : 40;

  let removed = 0;
  for (const [id, agent] of agents) {
    const dx = agent.position.x - agent.goalCoordinates.x;
    const dy = agent.position.y - agent.goalCoordinates.y;
    if (Math.hypot(dx, dy) <= threshold) {
      agents.delete(id);
      removed++;
    }
  }
  return removed;
}
