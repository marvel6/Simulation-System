import type { RedisConnection } from "./redis-client.js";
import { myAgents, myBounds } from "./agent.js";
import { updateAgentPosition } from "./steering.js";
import { emitBoundaryAgents, readNeighborBoundaryAgents } from "./boundary-sync.js";
import {
  initiateMigrationsForLeavingAgents,
  ingestIncomingAgents,
  confirmMigrationsAndPurge,
} from "./migration.js";

export async function tick(redis: RedisConnection, partitionId: string) {
  // 0. Ingest anything handed off to us by neighbors this tick (Step 2)
  await ingestIncomingAgents(redis, partitionId, myAgents);

  // 1. Move every agent (currently placeholder linear motion — see steering.ts)
  const allAgents = [...myAgents.values()];
  for (const agent of allAgents) {
    updateAgentPosition(agent, []); // neighbor list wired in once avoidance is built
  }

  // 2. Emit boundary state — only agents close to an edge, not everyone
  await emitBoundaryAgents(redis, partitionId, allAgents, myBounds);

  // 3. Read neighbors' boundary state for collision/avoidance checks
  const neighborAgents = await readNeighborBoundaryAgents(redis, partitionId);
  void neighborAgents; // feed into updateAgentPosition once steering is real

  // 4. Start migration for agents that left my bounds (Step 1)
  await initiateMigrationsForLeavingAgents(redis, partitionId, myAgents, myBounds);

  // 5. Check for ACKs on migrations already sent (Steps 3 → 4)
  await confirmMigrationsAndPurge(redis, partitionId, myAgents);
}
