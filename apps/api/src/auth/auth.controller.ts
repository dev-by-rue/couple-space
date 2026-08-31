import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { loadEnv } from "../config/env.js";
import type { AuthUser } from "./auth-user.types.js";
import { AuthService } from "./auth.service.js";
import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
} from "./cookies.js";
import { CurrentUser } from "./current-user.decorator.js";
import { loginSchema } from "./dto/login.schema.js";
import { registerSchema } from "./dto/register.schema.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = registerSchema.parse(body);
    const result = await this.auth.register(input);
    // Dual transport: cookies for web + JSON for native.
    setAuthCookies(response, result);
    return result;
  }

  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = loginSchema.parse(body);
    const result = await this.auth.login(input);
    setAuthCookies(response, result);
    return result;
  }

  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const raw =
      body?.refreshToken ??
      (request.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!raw) {
      clearAuthCookies(response);
      throw new ForbiddenException({ reason: "invalid_refresh" });
    }
    const result = await this.auth.refresh(raw);
    setAuthCookies(response, result);
    return result;
  }

  @Post("logout")
  async logout(
    @Req() request: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const raw =
      body?.refreshToken ??
      (request.cookies?.[REFRESH_COOKIE] as string | undefined);
    await this.auth.logout(raw);
    clearAuthCookies(response);
    return { ok: true };
  }

  /**
   * TEMPORARY: stands in for "click link in verification email".
   * Remove/replace when a mailer + verify-token flow exists.
   * Disabled unless ENABLE_DEV_AUTH_ENDPOINTS=true.
   * Re-issues cookies so JWT email_verified matches the DB.
   */
  @Post("dev/verify")
  @UseGuards(JwtAuthGuard)
  async devVerify(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!loadEnv().ENABLE_DEV_AUTH_ENDPOINTS) {
      throw new ForbiddenException({ reason: "dev_auth_disabled" });
    }
    const result = await this.auth.devVerify(user.id);
    setAuthCookies(response, result);
    return result;
  }
}
