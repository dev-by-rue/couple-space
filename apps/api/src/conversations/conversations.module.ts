import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PushModule } from "../push/push.module.js";
import { ConversationsController } from "./conversations.controller.js";
import { ConversationsService } from "./conversations.service.js";

@Module({
  imports: [AuthModule, PushModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
