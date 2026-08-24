import type { PartitionBounds } from "@crowd-sim/shared";
/**
 * Spawn agents inside this partition's bounds, walking toward the east exit.
 * Only the designated seed partition creates agents.
 */
export declare function seedAgents(partitionId: string, bounds: PartitionBounds, options?: {
    count?: number;
    seedPartition?: string;
    force?: boolean;
}): void;
