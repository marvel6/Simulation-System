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
