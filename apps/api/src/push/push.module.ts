import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PushController } from "./push.controller.js";
import { PUSH } from "./push.port.js";
import { PushService } from "./push.service.js";
import { createWebPush } from "./web-push.push.js";

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [
    PushService,
    { provide: PUSH, useFactory: () => createWebPush() },
  ],
  exports: [PushService],
})
export class PushModule {}
