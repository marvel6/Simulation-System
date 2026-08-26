import type { PartitionBounds } from "@crowd-sim/shared";
import {
  DEFAULT_PARTITION_BOUNDS,
  PARTITION_IDS,
  WORLD,
  redisKeys,
} from "@crowd-sim/shared";
import type { RedisConnection } from "./redis-client.js";
import type { PartitionLoad } from "./load-monitor.js";
import { fitnessH } from "./fitness-function.js";

const MIN_WIDTH = 80;
const SHIFT = 40;
const IMPROVE_EPSILON = 0.02;

function widthOf(b: PartitionBounds): number {
  return b.maxX - b.minX;
}

function boundsEqual(a: PartitionBounds, b: PartitionBounds): boolean {
  return (
    a.minX === b.minX &&
    a.maxX === b.maxX &&
    a.minY === b.minY &&
    a.maxY === b.maxY
  );
}

/**
 * When the world is empty, snap strips back to the default equal layout
 * so a finished dynamic run does not leave a skewed viewer forever.
 */
export async function maybeResetBoundsWhenEmpty(
  redis: RedisConnection,
  loads: PartitionLoad[]
): Promise<boolean> {
  if (loads.length === 0) return false;
  if (!loads.every((l) => l.agentCount === 0)) return false;

  let needsReset = false;
  for (const id of PARTITION_IDS) {
    const load = loads.find((l) => l.partitionId === id);
    let current = load?.bounds;
    if (!current || !(current.maxX > current.minX)) {
      const raw = await redis.get(redisKeys.partitionBounds(id));
      current = raw ? (JSON.parse(raw) as PartitionBounds) : undefined;
    }
    const def = DEFAULT_PARTITION_BOUNDS[id];
    if (!current || !boundsEqual(current, def)) {
      needsReset = true;
      break;
    }
  }

  if (!needsReset) return false;

  for (const id of PARTITION_IDS) {
    await redis.set(
      redisKeys.partitionBounds(id),
      JSON.stringify(DEFAULT_PARTITION_BOUNDS[id])
    );
  }

  console.log("[orchestrator] World empty — reset bounds to default equal strips");
  return true;
}

/**
 * Boundary-shift rebalancer for vertical strips.
 * Tries shifting each internal boundary left/right and keeps the move
 * that most improves H(P) without collapsing a strip below MIN_WIDTH.
 */
export async function maybeRebalance(
  redis: RedisConnection,
  loads: PartitionLoad[]
): Promise<boolean> {
  const currentH = fitnessH(loads);

  if (loads.every((l) => l.agentCount === 0)) return false;

  const bounds: Record<string, PartitionBounds> = {};

  for (const load of loads) {
    if (load.bounds.maxX > load.bounds.minX) {
      bounds[load.partitionId] = { ...load.bounds };
    }
  }

  // Ensure we have a full map
  for (const id of PARTITION_IDS) {
    if (!bounds[id]) {
      const raw = await redis.get(redisKeys.partitionBounds(id));
      if (raw) bounds[id] = JSON.parse(raw) as PartitionBounds;
    }
  }

  if (PARTITION_IDS.some((id) => !bounds[id])) return false;

  let bestH = currentH;
  let best: Record<string, PartitionBounds> | null = null;

  // Internal boundaries lie between consecutive strips i and i+1
  for (let i = 0; i < PARTITION_IDS.length - 1; i++) {
    const leftId = PARTITION_IDS[i];
    const rightId = PARTITION_IDS[i + 1];

    for (const delta of [-SHIFT, SHIFT]) {
      const candidate = structuredClone(bounds);
      const left = candidate[leftId];
      const right = candidate[rightId];
      const newBoundary = left.maxX + delta;

      if (newBoundary - left.minX < MIN_WIDTH) continue;
      if (right.maxX - newBoundary < MIN_WIDTH) continue;
      if (newBoundary <= 0 || newBoundary >= WORLD.width) continue;

      left.maxX = newBoundary;
      right.minX = newBoundary;

      // Estimate load after shift proportionally by width (cheap proxy)
      const estimated = loads.map((l) => {
        const b = candidate[l.partitionId];
        const oldW = Math.max(1, widthOf(bounds[l.partitionId]));
        const newW = Math.max(1, widthOf(b));
        return {
          ...l,
          bounds: b,
          agentCount: Math.round(l.agentCount * (newW / oldW)),
        };
      });

      const h = fitnessH(estimated);
      if (h + IMPROVE_EPSILON < bestH) {
        bestH = h;
        best = candidate;
      }
    }
  }

  if (!best) return false;

  for (const id of PARTITION_IDS) {
    await redis.set(redisKeys.partitionBounds(id), JSON.stringify(best[id]));
  }

  console.log(
    `[orchestrator] Rebalanced H ${currentH.toFixed(3)} → ${bestH.toFixed(3)}`,
    best
  );
  return true;
}
