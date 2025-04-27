const http  = require("http");
const https = require("https");
const { URL } = require("url");
const path  = require("path");
const { execFileSync } = require("child_process");

const LISTEN_PORT     = process.env.PORT || 8080;
const UPSTREAM_HOST   = "assetdelivery.roblox.com";
const UPSTREAM_ORIGIN = `https://${UPSTREAM_HOST}`;

function rewritePath(p) {
  const m = p.match(/^\/v1\/assetId\/(\d+)(?:\/?)$/);
  return m ? `/v1/asset?id=${m[1]}` : p;
}
function cliPath() {
  const exeDir = path.dirname(process.execPath);
  const name   = process.platform === "win32" ? "rbx_cookie.exe" : "rbx_cookie";
  return path.join(exeDir, name);
}

function readCookieFromCLI() {
  const p = cliPath();
  try {
    const raw = execFileSync(p, ["--format", "value"], { encoding: "utf8" }).trim();

    if (!raw.includes(".ROBLOSECURITY=")) return raw.replace(/;+$/, "");

    const m = raw.match(/\.ROBLOSECURITY=([^;]+)/);
    if (!m) throw new Error("no '=…;' pattern found");
    let tok = m[1];

    const i = tok.lastIndexOf("|_");
    if (i !== -1) tok = tok.slice(i + 2);
    return tok;
  } catch (err) {
    console.warn(`[proxy] rbx_cookie failed: ${err.message}`);
    return null;
  }
}

const TOKEN = readCookieFromCLI() || process.env.ROBLOX_COOKIE || null;
if (!TOKEN) {
  console.error(
    "[proxy] FATAL: no .ROBLOSECURITY token found.\n" +
    "        - place rbx_cookie(.exe) next to this script or\n" +
    "        - set environment variable ROBLOX_COOKIE=<token>"
  );
  process.exit(1);
}

+console.log(`[proxy] ✅ Using .ROBLOSECURITY token (${TOKEN.length} chars)`);


http.createServer((req, res) => {
  const upstreamPath = rewritePath(req.url);
  const upstreamURL  = new URL(upstreamPath, UPSTREAM_ORIGIN);

  const hdr = { ...req.headers };
  delete hdr.host;
  delete hdr["roblox-id"];
  delete hdr.traceparent;
  delete hdr.connection;
  delete hdr["proxy-connection"];
  delete hdr["transfer-encoding"];
  delete hdr["keep-alive"];
  delete hdr.te;
  delete hdr.trailer;
  delete hdr.upgrade;

  hdr["user-agent"]                     = "RoProxy";
  hdr["roblox-browser-asset-request"]   = "true";
  hdr["roblox-place-id"]                = "0";
  hdr.cookie                            = `.ROBLOSECURITY=${TOKEN}`;

  const proxyReq = https.request(
    upstreamURL,
    { method: req.method, headers: hdr },
    proxyRes => {
      if (proxyRes.statusCode === 302 && proxyRes.headers.location) {
        const body = JSON.stringify({ location: proxyRes.headers.location });
        res.writeHead(200, {
          "content-type"  : "application/json",
          "content-length": Buffer.byteLength(body)
        });
        res.end(body);
        return;
      }

      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", err => {
    console.error("  ✖ proxy error:", err.message);
    res.writeHead(502).end("Bad gateway");
  });

  req.pipe(proxyReq);
}).listen(LISTEN_PORT, () =>
  console.log(`Roblox AssetDelivery proxy listening → http://localhost:${LISTEN_PORT}\n`)
);