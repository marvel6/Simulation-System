// In-memory store of agents this partition currently owns.
export const myAgents = new Map();
// Mutable — the orchestrator can shrink/grow this during a rebalance (Objective iii).
// Starts as a placeholder quarter of the space; real values get set once the
// orchestrator's initial partition map is wired in.
export let myBounds = { minX: 0, maxX: 300, minY: 0, maxY: 600 };
export function setBounds(bounds) {
    myBounds = bounds;
}
export function isInBounds(pos, bounds) {
    return (pos.x >= bounds.minX &&
        pos.x <= bounds.maxX &&
        pos.y >= bounds.minY &&
        pos.y <= bounds.maxY);
}
