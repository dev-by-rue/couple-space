import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ConversationsModule } from "./conversations/conversations.module.js";
import { CouplesModule } from "./couples/couples.module.js";
import { DbModule } from "./db/db.module.js";
import { HealthController } from "./health.controller.js";
import { MailModule } from "./mail/mail.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    DbModule,
    MailModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CouplesModule,
    ConversationsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
