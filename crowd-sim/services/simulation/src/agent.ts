import type { Agent, PartitionBounds } from "@crowd-sim/shared";
import { defaultBoundsFor } from "@crowd-sim/shared";

// In-memory store of agents this partition currently owns.
export const myAgents: Map<string, Agent> = new Map();

// Mutable — the orchestrator can shrink/grow this during a rebalance (Objective iii).
export let myBounds: PartitionBounds = defaultBoundsFor(
  process.env.PARTITION_ID ?? "partition-A"
);

export function setBounds(bounds: PartitionBounds) {
  myBounds = bounds;
}

export function isInBounds(pos: { x: number; y: number }, bounds: PartitionBounds): boolean {
  return (
    pos.x >= bounds.minX &&
    pos.x <= bounds.maxX &&
    pos.y >= bounds.minY &&
    pos.y <= bounds.maxY
  );
}
