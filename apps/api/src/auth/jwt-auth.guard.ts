import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../token/token.service.js";
import type { AuthUser } from "./auth-user.types.js";
import { ACCESS_COOKIE } from "./cookies.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { authUser?: AuthUser }
    >();

    // Prefer Authorization for native; fall back to cookie for web.
    const header = request.headers.authorization;
    const bearer = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : undefined;
    const cookieToken = request.cookies?.[ACCESS_COOKIE] as string | undefined;
    const accessToken = bearer ?? cookieToken;

    if (!accessToken) {
      throw new UnauthorizedException();
    }

    try {
      request.authUser = await this.tokens.verifyAccessToken(accessToken);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
