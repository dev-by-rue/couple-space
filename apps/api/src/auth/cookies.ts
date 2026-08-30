import type { Response } from "express";
import { loadEnv } from "../config/env.js";
import type { TokenPair } from "../token/token-pair.types.js";

export const ACCESS_COOKIE = "cs_access";
export const REFRESH_COOKIE = "cs_refresh";

/**
 * Dual transport: browsers store tokens in httpOnly cookies (not readable by JS).
 * Native apps ignore Set-Cookie and use the JSON body instead.
 */
export function setAuthCookies(response: Response, pair: TokenPair): void {
  const env = loadEnv();
  const common = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
  };

  response.cookie(ACCESS_COOKIE, pair.accessToken, {
    ...common,
    maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  response.cookie(REFRESH_COOKIE, pair.refreshToken, {
    ...common,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(response: Response): void {
  const env = loadEnv();
  const common = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
  };
  response.clearCookie(ACCESS_COOKIE, common);
  response.clearCookie(REFRESH_COOKIE, common);
}
