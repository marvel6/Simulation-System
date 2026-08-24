import { WORLD } from "@crowd-sim/shared";
import { myAgents } from "./agent.js";
const DEFAULT_SEED_COUNT = Number(process.env.SEED_AGENT_COUNT ?? 40);
/**
 * Spawn agents inside this partition's bounds, walking toward the east exit.
 * Only partition-A seeds by default so agents migrate across B/C/D as they walk.
 */
export function seedAgents(partitionId, bounds) {
    if (partitionId !== "partition-A")
        return;
    if (myAgents.size > 0)
        return;
    const count = Number.isFinite(DEFAULT_SEED_COUNT) ? DEFAULT_SEED_COUNT : 40;
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    for (let i = 0; i < count; i++) {
        const agent = {
            agentId: `${partitionId}-agent-${i}`,
            position: {
                x: bounds.minX + 10 + Math.random() * (width - 20),
                y: bounds.minY + 10 + Math.random() * (height - 20),
            },
            velocity: { x: 0, y: 0 },
            targetExit: "east-gate",
            goalCoordinates: {
                x: WORLD.width - 10,
                y: WORLD.height * (0.3 + 0.4 * Math.random()),
            },
            radius: 2.5,
        };
        myAgents.set(agent.agentId, agent);
    }
    console.log(`[${partitionId}] Seeded ${myAgents.size} agents inside bounds`);
}
