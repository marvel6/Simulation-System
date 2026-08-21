import type { RedisConnection } from "./redis-client.js";
import type { Agent, PartitionBounds } from "@crowd-sim/shared";
export declare function isNearBoundary(agent: Agent, bounds: PartitionBounds): boolean;
export declare function emitBoundaryAgents(redis: RedisConnection, partitionId: string, agents: Agent[], bounds: PartitionBounds): Promise<void>;
export declare function getCurrentNeighborPartitionIds(_partitionId: string): Promise<string[]>;
export declare function readNeighborBoundaryAgents(redis: RedisConnection, partitionId: string): Promise<Agent[]>;
