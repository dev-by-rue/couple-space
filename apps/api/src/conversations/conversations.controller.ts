import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  Put,
} from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ConversationsService } from "./conversations.service.js";
import { createSessionSchema } from "./dto/create-session.schema.js";
import { submitResponseSchema } from "./dto/submit-response.schema.js";
import { saveDraftSchema } from "./dto/save-draft.schema.js";

@Controller()
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get("themes")
  listThemes(@CurrentUser() user: AuthUser) {
    return this.conversations.listThemes(user);
  }

  @Get("sessions")
  listSessions(@CurrentUser() user: AuthUser) {
    return this.conversations.listSessions(user);
  }

  @Post("sessions")
  createSession(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = createSessionSchema.parse(body);
    return this.conversations.createSession(user, input);
  }

  @Get("sessions/:id")
  getSession(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.conversations.getSession(user, id);
  }

  @Post("sessions/:id/responses")
  submitResponse(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const input = submitResponseSchema.parse(body);
    return this.conversations.submitResponse(user, id, input);
  }

  @Post("sessions/:id/reveal")
  revealSession(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.conversations.revealSession(user, id);
  }

  @Put("sessions/:id/responses/draft")
  @HttpCode(204)
  saveDraft(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const input = saveDraftSchema.parse(body);
    return this.conversations.saveDraft(user, id, input);
  }
}
