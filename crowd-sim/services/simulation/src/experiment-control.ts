import type { PartitionBounds } from "@crowd-sim/shared";
import { redisKeys } from "@crowd-sim/shared";
import type { RedisConnection } from "./redis-client.js";
import { myAgents, setBounds } from "./agent.js";
import { clearPendingMigrations } from "./migration.js";
import { seedAgents } from "./seed.js";

export interface ExperimentCommand {
  op: "reset-and-seed";
  nonce: string;
  seedPartition: string;
  agentCount: number;
  boundsByPartition: Record<string, PartitionBounds>;
}

/**
 * Applies a one-shot experiment command from Redis (idempotent per nonce).
 * All partitions clear local agents; the seed partition respawns the crowd.
 */
export async function maybeApplyExperimentCommand(
  redis: RedisConnection,
  partitionId: string
): Promise<boolean> {
  const raw = await redis.get(redisKeys.experimentCommand());
  if (!raw) return false;

  let cmd: ExperimentCommand;
  try {
    cmd = JSON.parse(raw) as ExperimentCommand;
  } catch {
    return false;
  }

  if (cmd.op !== "reset-and-seed" || !cmd.nonce) return false;

  const applied = await redis.get(redisKeys.experimentApplied(partitionId));
  if (applied === cmd.nonce) return false;

  const bounds = cmd.boundsByPartition[partitionId];
  if (bounds) setBounds(bounds);

  myAgents.clear();
  clearPendingMigrations();

  // Drop any queued migrations for this partition
  await redis.del(redisKeys.incomingAgents(partitionId));
  await redis.del(redisKeys.viewerAgents(partitionId));

  seedAgents(partitionId, bounds ?? { minX: 0, maxX: 300, minY: 0, maxY: 600 }, {
    count: cmd.agentCount,
    seedPartition: cmd.seedPartition,
    force: true,
  });

  await redis.set(redisKeys.experimentApplied(partitionId), cmd.nonce, { EX: 3600 });
  console.log(`[${partitionId}] Applied experiment command nonce=${cmd.nonce}`);
  return true;
}
