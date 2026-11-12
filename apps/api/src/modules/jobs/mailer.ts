import { createTransport } from "nodemailer";

// Outgoing email (PLAN M8 decision 7): nodemailer over SMTP, configured with Saleor's variables.
// `EMAIL_URL` is an SMTP URL (smtp://user:pass@host:port, smtps:// for TLS); `DEFAULT_FROM_EMAIL`
// is the sender. In dev both point at Mailpit (docker-compose). Jobs receive a `Mailer`, so tests
// can collect messages instead of sending them.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailConfig {
  url: string;
  from: string;
}

/** Reads the email configuration; a missing variable is named in the error. */
export function readEmailConfig(
  env: Record<string, string | undefined> = process.env,
): EmailConfig {
  const url = env.EMAIL_URL?.trim();
  const from = env.DEFAULT_FROM_EMAIL?.trim();
  if (!url) throw new Error("EMAIL_URL is not set (copy .env.example to .env)");
  if (!/^smtps?:\/\//.test(url)) throw new Error("EMAIL_URL must be an smtp:// or smtps:// URL");
  if (!from) throw new Error("DEFAULT_FROM_EMAIL is not set (copy .env.example to .env)");
  return { url, from };
}

/** A mailer sending through the configured SMTP server. */
export function createSmtpMailer(config: EmailConfig): Mailer {
  const transport = createTransport(config.url);
  return {
    async send(message) {
      await transport.sendMail({ from: config.from, ...message });
    },
  };
}
