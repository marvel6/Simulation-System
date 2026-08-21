import type { Agent } from "@crowd-sim/shared";

export function updateAgentPosition(agent: Agent, _neighbors: Agent[]) {
  agent.position.x += agent.velocity.x;
  agent.position.y += agent.velocity.y;
}