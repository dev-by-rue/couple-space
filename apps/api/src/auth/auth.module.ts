import { Module } from "@nestjs/common";
import { TokenService } from "../token/token.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService, TokenService, JwtAuthGuard],
  exports: [AuthService, EmailVerificationService, TokenService, JwtAuthGuard],
})
export class AuthModule {}
