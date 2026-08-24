export interface Vec2 {
    x: number;
    y: number;
}
export interface Agent {
    agentId: string;
    position: Vec2;
    velocity: Vec2;
    targetExit: string;
    goalCoordinates: Vec2;
    radius: number;
}
export interface PartitionBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}
/** Full simulation world size (stadium floor in abstract units). */
export declare const WORLD: {
    readonly width: 1200;
    readonly height: 600;
};
export declare const PARTITION_IDS: readonly ["partition-A", "partition-B", "partition-C", "partition-D"];
export type PartitionId = (typeof PARTITION_IDS)[number];
/**
 * Default vertical strips covering the world.
 * Orchestrator may rewrite these via Redis during rebalancing.
 */
export declare const DEFAULT_PARTITION_BOUNDS: Record<PartitionId, PartitionBounds>;
/** Left/right neighbors for the default strip layout. */
export declare const DEFAULT_NEIGHBOR_MAP: Record<PartitionId, PartitionId[]>;
export declare function isPartitionId(id: string): id is PartitionId;
export declare function defaultBoundsFor(partitionId: string): PartitionBounds;
export declare function neighborsFor(partitionId: string): string[];
/** Find which partition currently owns a world position. */
export declare function resolveOwnerPartition(pos: Vec2, boundsByPartition: Record<string, PartitionBounds>): string | null;
