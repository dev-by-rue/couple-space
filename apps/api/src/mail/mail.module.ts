import { Global, Module } from "@nestjs/common";
import { MAIL } from "./mail.port.js";
import { createSmtpMail } from "./smtp.mail.js";

@Global()
@Module({
  providers: [{ provide: MAIL, useFactory: () => createSmtpMail() }],
  exports: [MAIL],
})
export class MailModule {}
