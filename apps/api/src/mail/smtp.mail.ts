import nodemailer from "nodemailer";
import { loadEnv } from "../config/env.js";
import type { MailPort, SendMailInput } from "./mail.port.js";

/**
 * SMTP transport — local Ethereal credentials in .env; swap host for a real ESP later.
 * Never log message bodies that contain verify tokens.
 */
export function createSmtpMail(): MailPort {
  const env = loadEnv();
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  return {
    async sendMail(input: SendMailInput) {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    },
  };
}
