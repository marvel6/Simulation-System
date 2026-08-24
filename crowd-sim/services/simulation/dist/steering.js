/** Simulation timestep in seconds (matches 100ms tick). */
export const DT = 0.1;
const PREFERRED_SPEED = 1.5;
const TAU = 0.5; // relaxation time toward desired velocity
const REPULSION_A = 40; // interaction strength
const REPULSION_B = 12; // interaction range falloff
const MAX_SPEED = 3.0;
const INTERACTION_RADIUS = 40;
function length(v) {
    return Math.hypot(v.x, v.y);
}
function normalize(v) {
    const len = length(v);
    if (len < 1e-8)
        return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}
function clampSpeed(v, max) {
    const speed = length(v);
    if (speed <= max || speed < 1e-8)
        return v;
    const scale = max / speed;
    return { x: v.x * scale, y: v.y * scale };
}
/**
 * Helbing-style Social Force Model (dissertation §2.3.1):
 *   F = F_desired + Σ F_repulsive(neighbors)
 * Acceleration updates velocity, then position.
 */
export function updateAgentPosition(agent, neighbors) {
    const toGoal = {
        x: agent.goalCoordinates.x - agent.position.x,
        y: agent.goalCoordinates.y - agent.position.y,
    };
    const distToGoal = length(toGoal);
    // Arrived — damp velocity and stop integrating large steps
    if (distToGoal < agent.radius) {
        agent.velocity.x *= 0.5;
        agent.velocity.y *= 0.5;
        return;
    }
    const dir = normalize(toGoal);
    const desiredVelocity = {
        x: dir.x * PREFERRED_SPEED,
        y: dir.y * PREFERRED_SPEED,
    };
    // Eq. 2.2 — drive toward preferred velocity
    const desiredForce = {
        x: (desiredVelocity.x - agent.velocity.x) / TAU,
        y: (desiredVelocity.y - agent.velocity.y) / TAU,
    };
    // Eq. 2.3 — exponential repulsion from nearby agents
    let repulsiveX = 0;
    let repulsiveY = 0;
    for (const other of neighbors) {
        if (other.agentId === agent.agentId)
            continue;
        const dx = agent.position.x - other.position.x;
        const dy = agent.position.y - other.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1e-6 || dist > INTERACTION_RADIUS)
            continue;
        const overlap = agent.radius + other.radius - dist;
        const magnitude = REPULSION_A * Math.exp(overlap / REPULSION_B);
        const n = normalize({ x: dx, y: dy });
        repulsiveX += magnitude * n.x;
        repulsiveY += magnitude * n.y;
    }
    const ax = desiredForce.x + repulsiveX;
    const ay = desiredForce.y + repulsiveY;
    agent.velocity.x += ax * DT;
    agent.velocity.y += ay * DT;
    const clamped = clampSpeed(agent.velocity, MAX_SPEED);
    agent.velocity.x = clamped.x;
    agent.velocity.y = clamped.y;
    agent.position.x += agent.velocity.x * DT;
    agent.position.y += agent.velocity.y * DT;
}
