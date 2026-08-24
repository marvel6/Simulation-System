import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "./redis-client.js";
import { readWorldSnapshot } from "./snapshot.js";
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL)
    throw new Error("REDIS_URL environment variable is required");
const PORT = Number(process.env.PORT ?? 8080);
const STREAM_MS = Number(process.env.VIEWER_STREAM_MS ?? 200);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const redis = createClient({ url: REDIS_URL });
redis.on("error", (err) => console.error("[viewer] Redis error:", err));
await redis.connect();
function contentType(filePath) {
    if (filePath.endsWith(".html"))
        return "text/html; charset=utf-8";
    if (filePath.endsWith(".js"))
        return "text/javascript; charset=utf-8";
    if (filePath.endsWith(".css"))
        return "text/css; charset=utf-8";
    return "application/octet-stream";
}
function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
    });
    res.end(payload);
}
function serveStatic(reqPath, res) {
    const safe = reqPath === "/" ? "/index.html" : reqPath;
    const filePath = path.normalize(path.join(publicDir, safe));
    if (!filePath.startsWith(publicDir)) {
        res.writeHead(403).end("Forbidden");
        return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404).end("Not found");
        return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
}
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname === "/api/health") {
        sendJson(res, 200, { ok: true });
        return;
    }
    if (url.pathname === "/api/snapshot") {
        try {
            sendJson(res, 200, await readWorldSnapshot(redis));
        }
        catch (err) {
            console.error("[viewer] snapshot error:", err);
            sendJson(res, 500, { error: "snapshot_failed" });
        }
        return;
    }
    if (url.pathname === "/api/stream") {
        res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        });
        res.write(": connected\n\n");
        let closed = false;
        req.on("close", () => {
            closed = true;
        });
        while (!closed) {
            try {
                const snap = await readWorldSnapshot(redis);
                res.write(`data: ${JSON.stringify(snap)}\n\n`);
            }
            catch (err) {
                console.error("[viewer] stream error:", err);
                res.write(`event: error\ndata: {"error":"snapshot_failed"}\n\n`);
            }
            await new Promise((r) => setTimeout(r, STREAM_MS));
        }
        return;
    }
    serveStatic(url.pathname, res);
});
server.listen(PORT, () => {
    console.log(`[viewer] Listening on :${PORT} (stream every ${STREAM_MS}ms)`);
});
