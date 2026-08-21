import type { Agent, PartitionBounds } from "@crowd-sim/shared";
export declare const myAgents: Map<string, Agent>;
export declare let myBounds: PartitionBounds;
export declare function setBounds(bounds: PartitionBounds): void;
export declare function isInBounds(pos: {
    x: number;
    y: number;
}, bounds: PartitionBounds): boolean;
