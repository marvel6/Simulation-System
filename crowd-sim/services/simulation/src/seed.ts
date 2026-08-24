import type { Agent, PartitionBounds } from "@crowd-sim/shared";
import { WORLD } from "@crowd-sim/shared";
import { myAgents } from "./agent.js";

/**
 * Spawn agents inside this partition's bounds, walking toward the east exit.
 * Only the designated seed partition creates agents.
 */
export function seedAgents(
  partitionId: string,
  bounds: PartitionBounds,
  options?: { count?: number; seedPartition?: string; force?: boolean }
) {
  const seedPartition = options?.seedPartition ?? "partition-A";
  if (partitionId !== seedPartition) return;
  if (!options?.force && myAgents.size > 0) return;

  myAgents.clear();

  const count = options?.count ?? Number(process.env.SEED_AGENT_COUNT ?? 40);
  const n = Number.isFinite(count) && count > 0 ? count : 40;
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);

  for (let i = 0; i < n; i++) {
    const agent: Agent = {
      agentId: `${partitionId}-agent-${i}-${Date.now()}`,
      position: {
        x: bounds.minX + 10 + Math.random() * (width - 20),
        y: bounds.minY + 10 + Math.random() * (height - 20),
      },
      velocity: { x: 0, y: 0 },
      targetExit: "east-gate",
      goalCoordinates: {
        x: WORLD.width - 10,
        y: WORLD.height * (0.3 + 0.4 * Math.random()),
      },
      radius: 2.5,
    };
    myAgents.set(agent.agentId, agent);
  }

  console.log(`[${partitionId}] Seeded ${myAgents.size} agents inside bounds`);
}
