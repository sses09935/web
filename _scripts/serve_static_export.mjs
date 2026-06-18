import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "out");
const portArgIndex = process.argv.indexOf("--port");
const port = Number(
  portArgIndex >= 0 ? process.argv[portArgIndex + 1] : process.env.PORT ?? 3000,
);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${port}`);
  process.exit(1);
}

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const resolveRequestPath = (requestUrl) => {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = path.join(outDir, normalizedPath);
  const relativePath = path.relative(outDir, requestedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  const candidates = [
    requestedPath,
    path.join(requestedPath, "index.html"),
  ];

  if (!path.extname(requestedPath)) {
    candidates.push(`${requestedPath}.html`);
  }

  return candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
};

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end("Method not allowed");
    return;
  }

  const requestedFile = resolveRequestPath(req.url);
  const filePath = requestedFile ?? path.join(outDir, "404.html");

  try {
    const body = await readFile(filePath);
    const extension = path.extname(filePath);
    res.writeHead(requestedFile ? 200 : 404, {
      "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Static export preview listening on http://127.0.0.1:${port}`);
});
