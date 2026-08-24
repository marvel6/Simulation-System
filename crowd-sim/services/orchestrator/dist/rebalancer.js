import { PARTITION_IDS, WORLD, redisKeys } from "@crowd-sim/shared";
import { fitnessH } from "./fitness-function.js";
const MIN_WIDTH = 80;
const SHIFT = 40;
const IMPROVE_EPSILON = 0.02;
function widthOf(b) {
    return b.maxX - b.minX;
}
/**
 * Boundary-shift rebalancer for vertical strips.
 * Tries shifting each internal boundary left/right and keeps the move
 * that most improves H(P) without collapsing a strip below MIN_WIDTH.
 */
export async function maybeRebalance(redis, loads) {
    const currentH = fitnessH(loads);
    if (loads.every((l) => l.agentCount === 0))
        return false;
    const bounds = {};
    for (const load of loads) {
        if (load.bounds.maxX > load.bounds.minX) {
            bounds[load.partitionId] = { ...load.bounds };
        }
    }
    // Ensure we have a full map
    for (const id of PARTITION_IDS) {
        if (!bounds[id]) {
            const raw = await redis.get(redisKeys.partitionBounds(id));
            if (raw)
                bounds[id] = JSON.parse(raw);
        }
    }
    if (PARTITION_IDS.some((id) => !bounds[id]))
        return false;
    let bestH = currentH;
    let best = null;
    // Internal boundaries lie between consecutive strips i and i+1
    for (let i = 0; i < PARTITION_IDS.length - 1; i++) {
        const leftId = PARTITION_IDS[i];
        const rightId = PARTITION_IDS[i + 1];
        for (const delta of [-SHIFT, SHIFT]) {
            const candidate = structuredClone(bounds);
            const left = candidate[leftId];
            const right = candidate[rightId];
            const newBoundary = left.maxX + delta;
            if (newBoundary - left.minX < MIN_WIDTH)
                continue;
            if (right.maxX - newBoundary < MIN_WIDTH)
                continue;
            if (newBoundary <= 0 || newBoundary >= WORLD.width)
                continue;
            left.maxX = newBoundary;
            right.minX = newBoundary;
            // Estimate load after shift proportionally by width (cheap proxy)
            const estimated = loads.map((l) => {
                const b = candidate[l.partitionId];
                const oldW = Math.max(1, widthOf(bounds[l.partitionId]));
                const newW = Math.max(1, widthOf(b));
                return {
                    ...l,
                    bounds: b,
                    agentCount: Math.round(l.agentCount * (newW / oldW)),
                };
            });
            const h = fitnessH(estimated);
            if (h + IMPROVE_EPSILON < bestH) {
                bestH = h;
                best = candidate;
            }
        }
    }
    if (!best)
        return false;
    for (const id of PARTITION_IDS) {
        await redis.set(redisKeys.partitionBounds(id), JSON.stringify(best[id]));
    }
    console.log(`[orchestrator] Rebalanced H ${currentH.toFixed(3)} → ${bestH.toFixed(3)}`, best);
    return true;
}
