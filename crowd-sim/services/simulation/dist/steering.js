/**
 * PLACEHOLDER — this is a straight-line movement, not the Social Force Model.
 *
 * Dissertation section 2.3.1 (Eq. 2.1–2.3) specifies the real model:
 *   - a "desired force" pulling the agent toward goalCoordinates (Eq. 2.2)
 *   - a repulsive force from every neighboring agent within AOI (Eq. 2.3)
 *   - a repulsive force from walls/obstacles
 * These three sum to acceleration, which updates velocity, which updates position.
 *
 * This function is the one to replace when you build the real steering model —
 * everything else in the tick loop stays the same, since it just calls this.
 */
export function updateAgentPosition(agent, _neighbors) {
    agent.position.x += agent.velocity.x;
    agent.position.y += agent.velocity.y;
}
