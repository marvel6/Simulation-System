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
export const WORLD = {
  width: 1200,
  height: 600,
} as const;

export const PARTITION_IDS = [
  "partition-A",
  "partition-B",
  "partition-C",
  "partition-D",
] as const;

export type PartitionId = (typeof PARTITION_IDS)[number];

/**
 * Default vertical strips covering the world.
 * Orchestrator may rewrite these via Redis during rebalancing.
 */
export const DEFAULT_PARTITION_BOUNDS: Record<PartitionId, PartitionBounds> = {
  "partition-A": { minX: 0, maxX: 300, minY: 0, maxY: WORLD.height },
  "partition-B": { minX: 300, maxX: 600, minY: 0, maxY: WORLD.height },
  "partition-C": { minX: 600, maxX: 900, minY: 0, maxY: WORLD.height },
  "partition-D": { minX: 900, maxX: 1200, minY: 0, maxY: WORLD.height },
};

/** Left/right neighbors for the default strip layout. */
export const DEFAULT_NEIGHBOR_MAP: Record<PartitionId, PartitionId[]> = {
  "partition-A": ["partition-B"],
  "partition-B": ["partition-A", "partition-C"],
  "partition-C": ["partition-B", "partition-D"],
  "partition-D": ["partition-C"],
};

export function isPartitionId(id: string): id is PartitionId {
  return (PARTITION_IDS as readonly string[]).includes(id);
}

export function defaultBoundsFor(partitionId: string): PartitionBounds {
  if (isPartitionId(partitionId)) return { ...DEFAULT_PARTITION_BOUNDS[partitionId] };
  return { ...DEFAULT_PARTITION_BOUNDS["partition-A"] };
}

export function neighborsFor(partitionId: string): string[] {
  if (isPartitionId(partitionId)) return [...DEFAULT_NEIGHBOR_MAP[partitionId]];
  return [];
}

/** Find which partition currently owns a world position. */
export function resolveOwnerPartition(
  pos: Vec2,
  boundsByPartition: Record<string, PartitionBounds>
): string | null {
  for (const [id, bounds] of Object.entries(boundsByPartition)) {
    if (
      pos.x >= bounds.minX &&
      pos.x <= bounds.maxX &&
      pos.y >= bounds.minY &&
      pos.y <= bounds.maxY
    ) {
      return id;
    }
  }
  return null;
}
