import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { UsersService } from "./users.service.js";

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.id);
  }
}
