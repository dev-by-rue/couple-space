import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CouplesService } from "./couples.service.js";
import { createInvitationSchema } from "./dto/create-invitation.schema.js";

@Controller()
@UseGuards(JwtAuthGuard)
export class CouplesController {
  constructor(private readonly couples: CouplesService) {}

  @Post("couples")
  createCouple(@CurrentUser() user: AuthUser) {
    return this.couples.createCouple(user);
  }

  @Get("couples/me")
  getMyCouple(@CurrentUser() user: AuthUser) {
    return this.couples.getMyCouple(user);
  }

  @Post("couples/:coupleId/invitations")
  createInvitation(
    @CurrentUser() user: AuthUser,
    @Param("coupleId") coupleId: string,
    @Body() body: unknown,
  ) {
    const input = createInvitationSchema.parse(body);
    return this.couples.createInvitation(user, coupleId, input);
  }

  @Post("invitations/:token/accept")
  acceptInvitation(
    @CurrentUser() user: AuthUser,
    @Param("token") token: string,
  ) {
    return this.couples.acceptInvitation(user, token);
  }

  @Post("invitations/:token/revoke")
  revokeInvitation(
    @CurrentUser() user: AuthUser,
    @Param("token") token: string,
  ) {
    return this.couples.revokeInvitation(user, token);
  }
}
