/** Full simulation world size (stadium floor in abstract units). */
export const WORLD = {
    width: 1200,
    height: 600,
};
export const PARTITION_IDS = [
    "partition-A",
    "partition-B",
    "partition-C",
    "partition-D",
];
/**
 * Default vertical strips covering the world.
 * Orchestrator may rewrite these via Redis during rebalancing.
 */
export const DEFAULT_PARTITION_BOUNDS = {
    "partition-A": { minX: 0, maxX: 300, minY: 0, maxY: WORLD.height },
    "partition-B": { minX: 300, maxX: 600, minY: 0, maxY: WORLD.height },
    "partition-C": { minX: 600, maxX: 900, minY: 0, maxY: WORLD.height },
    "partition-D": { minX: 900, maxX: 1200, minY: 0, maxY: WORLD.height },
};
/** Left/right neighbors for the default strip layout. */
export const DEFAULT_NEIGHBOR_MAP = {
    "partition-A": ["partition-B"],
    "partition-B": ["partition-A", "partition-C"],
    "partition-C": ["partition-B", "partition-D"],
    "partition-D": ["partition-C"],
};
export function isPartitionId(id) {
    return PARTITION_IDS.includes(id);
}
export function defaultBoundsFor(partitionId) {
    if (isPartitionId(partitionId))
        return { ...DEFAULT_PARTITION_BOUNDS[partitionId] };
    return { ...DEFAULT_PARTITION_BOUNDS["partition-A"] };
}
export function neighborsFor(partitionId) {
    if (isPartitionId(partitionId))
        return [...DEFAULT_NEIGHBOR_MAP[partitionId]];
    return [];
}
/** Find which partition currently owns a world position. */
export function resolveOwnerPartition(pos, boundsByPartition) {
    for (const [id, bounds] of Object.entries(boundsByPartition)) {
        if (pos.x >= bounds.minX &&
            pos.x <= bounds.maxX &&
            pos.y >= bounds.minY &&
            pos.y <= bounds.maxY) {
            return id;
        }
    }
    return null;
}
