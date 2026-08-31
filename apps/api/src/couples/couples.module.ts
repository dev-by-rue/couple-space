import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CouplesController } from "./couples.controller.js";
import { CouplesService } from "./couples.service.js";

@Module({
  imports: [AuthModule],
  controllers: [CouplesController],
  providers: [CouplesService],
  exports: [CouplesService],
})
export class CouplesModule {}
