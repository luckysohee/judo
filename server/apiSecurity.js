import cors from "cors";
import rateLimit from "express-rate-limit";
import { getSupabaseJwtVerifyClient } from "./utils/supabaseJwtAuth.js";
import {
  isAlphaAllowlistEnabledServer,
  requireAlphaAllowlistForApi,
} from "./alphaAccess.js";

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

/** OpenAI·크롤러 등 — 로그인 JWT 필수 */
export const API_AUTH_REQUIRED_PREFIXES = [
  "/api/ai-search",
  "/api/search-intent-assist",
  "/api/course-compose-assist",
  "/api/course-draft-assist",
  "/api/blog-reviews",
  "/api/nearby-with-blog",
];

/** 비용·쿼터 소모 큼 — 더 빡센 rate limit */
export const API_EXPENSIVE_PREFIXES = [
  ...API_AUTH_REQUIRED_PREFIXES,
  "/api/unified-map-search",
  "/api/google-place-photos",
  "/api/google-place-photo-legacy",
  "/api/google-place-photo-media",
  "/api/kakao/",
];

function parseCsvEnv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const fromEnv = parseCsvEnv(process.env.API_CORS_ORIGINS);
  if (fromEnv.length > 0) return [...new Set(fromEnv)];
  if (process.env.NODE_ENV === "production") return [];
  return [...DEFAULT_DEV_ORIGINS];
}

function getSupabaseAuthClient() {
  return getSupabaseJwtVerifyClient();
}

function pathMatchesPrefix(path, prefixes) {
  return prefixes.some((p) => path === p || path.startsWith(p));
}

function isAuthRequired(path) {
  if (process.env.API_REQUIRE_AUTH === "false") return false;
  return pathMatchesPrefix(path, API_AUTH_REQUIRED_PREFIXES);
}

export function createCorsMiddleware() {
  const allowedOrigins = getAllowedOrigins();
  console.log(
    "🔒 API CORS origins:",
    allowedOrigins.length > 0 ? allowedOrigins.join(", ") : "(none — non-browser only)"
  );

  return cors({
    origin(origin, callback) {
      // curl·서버·Vercel rewrite 등 Origin 없음 → 허용
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) {
        return callback(null, false);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  });
}

function createLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: message },
    skip: (req) => req.path === "/api/health",
  });
}

export async function requireSupabaseAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized — login required",
    });
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    console.warn("⚠️ SUPABASE_ANON_KEY 없음 — JWT 검증 스킵(API_REQUIRE_AUTH=false 권장)");
    return next();
  }

  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({
        ok: false,
        error: "Invalid or expired session",
      });
    }
    req.authUser = data.user;
    return next();
  } catch (e) {
    console.warn("JWT verify error:", e?.message || e);
    return res.status(401).json({
      ok: false,
      error: "Invalid or expired session",
    });
  }
}

export function setupApiSecurity(app) {
  app.set("trust proxy", 1);

  const windowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60_000;
  const globalMax = Number(process.env.API_RATE_LIMIT_MAX) || 120;
  const expensiveMax = Number(process.env.API_RATE_LIMIT_EXPENSIVE_MAX) || 24;

  const globalLimiter = createLimiter({
    windowMs,
    max: globalMax,
    message: "Too many requests — try again shortly",
  });
  app.use(globalLimiter);

  const expensiveLimiter = createLimiter({
    windowMs,
    max: expensiveMax,
    message: "Too many API requests for this endpoint — slow down",
  });

  app.use((req, res, next) => {
    if (!pathMatchesPrefix(req.path, API_EXPENSIVE_PREFIXES)) {
      return next();
    }
    return expensiveLimiter(req, res, next);
  });

  app.use((req, res, next) => requireAlphaAllowlistForApi(req, res, next));

  app.use((req, res, next) => {
    if (!isAuthRequired(req.path)) return next();
    return requireSupabaseAuth(req, res, next);
  });

  console.log(
    "🔒 API security:",
    `rate ${globalMax}/${windowMs}ms, expensive ${expensiveMax}, auth paths ${API_AUTH_REQUIRED_PREFIXES.length}`,
    isAlphaAllowlistEnabledServer() ? ", alpha allowlist ON" : ""
  );
}
