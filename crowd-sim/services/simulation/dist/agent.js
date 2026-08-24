import { defaultBoundsFor } from "@crowd-sim/shared";
// In-memory store of agents this partition currently owns.
export const myAgents = new Map();
// Mutable — the orchestrator can shrink/grow this during a rebalance (Objective iii).
export let myBounds = defaultBoundsFor(process.env.PARTITION_ID ?? "partition-A");
export function setBounds(bounds) {
    myBounds = bounds;
}
export function isInBounds(pos, bounds) {
    return (pos.x >= bounds.minX &&
        pos.x <= bounds.maxX &&
        pos.y >= bounds.minY &&
        pos.y <= bounds.maxY);
}
