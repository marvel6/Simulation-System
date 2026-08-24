import type { PartitionBounds } from "@crowd-sim/shared";
/**
 * Spawn agents inside this partition's bounds, walking toward the east exit.
 * Only partition-A seeds by default so agents migrate across B/C/D as they walk.
 */
export declare function seedAgents(partitionId: string, bounds: PartitionBounds): void;
