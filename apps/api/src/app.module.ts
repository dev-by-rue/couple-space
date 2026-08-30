import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { DbModule } from "./db/db.module.js";
import { HealthController } from "./health.controller.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [DbModule, AuditModule, AuthModule, UsersModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
