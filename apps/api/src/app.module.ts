import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { DbModule } from "./db/db.module.js";
import { HealthController } from "./health.controller.js";
import { TokenService } from './token/token.service.js';

@Module({
  imports: [DbModule],
  controllers: [AppController, HealthController],
  providers: [AppService, TokenService],
})
export class AppModule {}
