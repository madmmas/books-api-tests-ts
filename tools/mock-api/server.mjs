/**
 * Minimal stand-in for the Books auth API.
 *
 * PURPOSE: let the test harness be developed and verified before the real API
 * is reachable, and keep CI for this repo self-contained.
 *
 * NOT A SUBSTITUTE FOR TESTING THE REAL API. A green run against this mock
 * proves the harness works, nothing about the product. CI runs the suite
 * against a real deployment; the mock is opt-in via `npm run mock-api`.
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_API_PORT ?? 8080);
const ALTCHA_ENABLED = (process.env.ALTCHA_ENABLED ?? "").trim().toLowerCase() === "true";
const HMAC_SECRET = "mock-altcha-secret";
const MAX_NUMBER = 50_000;
const USERS = new Map([
  [
    (process.env.BUYER_USERNAME ?? "buyer@example.com").toLowerCase(),
    {
      id: "usr_" + randomUUID(),
      password: process.env.BUYER_PASSWORD ?? "Password123!",
      role: "user",
    },
  ],
]);

/** Solutions already spent, so a captcha cannot be replayed. */
const usedChallenges = new Set();

function sign(value) {
  return createHmac("sha256", HMAC_SECRET).update(value).digest("hex");
}

function makeChallenge() {
  const salt = randomBytes(12).toString("hex");
  const number = Math.floor(Math.random() * 1000);
  const challenge = createHash("sha256").update(`${salt}${number}`).digest("hex");
  return {
    algorithm: "SHA-256",
    challenge,
    salt,
    signature: sign(challenge),
    maxnumber: MAX_NUMBER,
  };
}

function verifyAltcha(encoded) {
  if (typeof encoded !== "string" || encoded.length === 0) return "captcha_required";

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    return "captcha_invalid";
  }

  const { algorithm, challenge, number, salt, signature } = payload ?? {};
  if (algorithm !== "SHA-256" || typeof challenge !== "string" || typeof salt !== "string") {
    return "captcha_invalid";
  }

  const expected = Buffer.from(sign(challenge));
  const given = Buffer.from(String(signature ?? ""));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return "captcha_invalid";
  }

  if (createHash("sha256").update(`${salt}${number}`).digest("hex") !== challenge) {
    return "captcha_invalid";
  }

  if (usedChallenges.has(challenge)) return "captcha_invalid";
  usedChallenges.add(challenge);
  return null;
}

function jwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${body}.${sign(`${header}.${body}`).slice(0, 43)}`;
}

function send(res, status, body, extraHeaders = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(json),
    ...extraHeaders,
  });
  res.end(json);
}

function handleLogin(body, res) {
  const { username, password, altcha } = body ?? {};

  if (ALTCHA_ENABLED) {
    const captchaError = verifyAltcha(altcha);
    if (captchaError) {
      return send(res, 400, { code: captchaError, message: "Captcha verification failed" });
    }
  }

  if (typeof username !== "string" || typeof password !== "string") {
    return send(res, 400, {
      code: "validation_error",
      message: "username and password are required",
    });
  }
  if (username.length === 0 || password.length === 0) {
    return send(res, 400, {
      code: "validation_error",
      message: "username and password must not be empty",
    });
  }
  if (username.length > 320 || password.length > 256) {
    return send(res, 400, {
      code: "validation_error",
      message: "username or password is too long",
    });
  }

  const user = USERS.get(username.trim().toLowerCase());
  // Identical response for a wrong password and an unknown user.
  if (!user || user.password !== password) {
    return send(res, 401, { code: "invalid_credentials", message: "Invalid username or password" });
  }

  const now = Math.floor(Date.now() / 1000);
  return send(res, 200, {
    accessToken: jwt({ sub: user.id, iat: now, exp: now + 900, role: user.role }),
    refreshToken: randomBytes(32).toString("hex"),
    tokenType: "Bearer",
    user: { id: user.id, username: username.trim().toLowerCase(), role: user.role },
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { status: "ok", uptime: process.uptime() });
  }

  if (req.method === "GET" && url.pathname === "/auth/altcha/challenge") {
    return send(res, 200, makeChallenge());
  }

  if (req.method === "POST" && url.pathname === "/auth/jwt/login") {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        handleLogin(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"), res);
      } catch {
        send(res, 400, { code: "validation_error", message: "Body is not valid JSON" });
      }
    });
    return;
  }

  return send(res, 404, { code: "not_found", message: "Unknown endpoint" });
});

server.listen(PORT, () => {
  process.stdout.write(`mock Books auth API listening on http://localhost:${PORT}\n`);
});
