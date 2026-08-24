const COLORS = {
  "partition-A": "#5b8def",
  "partition-B": "#3dbb8b",
  "partition-C": "#e0a453",
  "partition-D": "#d76b6b",
};

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const legendEl = document.getElementById("legend");

function draw(snapshot) {
  const { world, partitions, totalAgents } = snapshot;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // floor
  ctx.fillStyle = "#0d131a";
  ctx.fillRect(0, 0, world.width, world.height);

  // grid
  ctx.strokeStyle = "#1b2733";
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, world.height);
    ctx.stroke();
  }
  for (let y = 0; y <= world.height; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(world.width, y + 0.5);
    ctx.stroke();
  }

  // partition bounds
  for (const part of partitions) {
    const color = COLORS[part.partitionId] ?? "#888";
    const { minX, maxX, minY, maxY } = part.bounds;
    const w = Math.max(0, maxX - minX);
    const h = Math.max(0, maxY - minY);

    ctx.fillStyle = color + "33";
    ctx.fillRect(minX, minY, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(minX + 1, minY + 1, Math.max(0, w - 2), Math.max(0, h - 2));

    ctx.fillStyle = color;
    ctx.font = "12px IBM Plex Sans, sans-serif";
    ctx.fillText(part.partitionId.replace("partition-", ""), minX + 8, minY + 18);
  }

  // agents
  for (const part of partitions) {
    const color = COLORS[part.partitionId] ?? "#ddd";
    ctx.fillStyle = color;
    for (const agent of part.agents) {
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // east exit marker
  ctx.fillStyle = "#f2f6fb";
  ctx.fillRect(world.width - 8, world.height * 0.25, 6, world.height * 0.5);

  statusEl.textContent = `agents=${totalAgents} · updated ${new Date(snapshot.updatedAt).toLocaleTimeString()}`;

  legendEl.innerHTML = partitions
    .map((p) => {
      const color = COLORS[p.partitionId] ?? "#888";
      return `<div class="row"><span class="swatch" style="background:${color}"></span><span>${p.partitionId}: ${p.agents.length} · x ${p.bounds.minX}–${p.bounds.maxX}</span></div>`;
    })
    .join("");
}

const stream = new EventSource("/api/stream");
stream.onmessage = (ev) => {
  try {
    draw(JSON.parse(ev.data));
  } catch (err) {
    console.error(err);
  }
};
stream.onerror = () => {
  statusEl.textContent = "Stream disconnected — retrying…";
};
