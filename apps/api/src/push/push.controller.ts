import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { PushService } from "./push.service.js";
import {
  pushSubscriptionSchema,
  removePushSubscriptionSchema,
} from "./dto/push-subscription.schema.js";

@Controller("push")
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post("subscriptions")
  @HttpCode(204)
  subscribe(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = pushSubscriptionSchema.parse(body);
    return this.push.subscribe(user, input);
  }

  @Delete("subscriptions")
  @HttpCode(204)
  unsubscribe(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = removePushSubscriptionSchema.parse(body);
    return this.push.unsubscribe(user, input);
  }
}
