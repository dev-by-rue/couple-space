export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface MailPort {
  sendMail(input: SendMailInput): Promise<void>;
}

export const MAIL = Symbol("MAIL");
