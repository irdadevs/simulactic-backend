import { randomInt } from "crypto";
import { IMailer } from "../../app/interfaces/Mailer.port";
import { Email } from "../../domain/aggregates/User";
import { ErrorFactory } from "../../utils/errors/Error.map";

const nodemailer = require("nodemailer");

type MailerConfig = {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  isProd?: boolean;
};

export class MailerRepo implements IMailer {
  private readonly transporter: any | null;
  private readonly from: string;
  private readonly isProd: boolean;

  constructor(config?: MailerConfig) {
    const host = config?.host ?? process.env.SMTP_HOST;
    const port = config?.port ?? Number(process.env.SMTP_PORT ?? 0);
    const user = config?.user ?? process.env.SMTP_USER;
    const pass = config?.pass ?? process.env.SMTP_PASS;
    this.from = config?.from ?? process.env.SMTP_FROM ?? "no-reply@simulactic.app";
    this.isProd = config?.isProd ?? process.env.NODE_ENV === "production";

    if (host && Number.isFinite(port) && port > 0) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: config?.secure ?? process.env.SMTP_SECURE === "true",
        auth: user && pass ? { user, pass } : undefined,
      });
      return;
    }

    this.transporter = null;
  }

  genCode(long: number = 8): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < long; i++) {
      code += chars[randomInt(0, chars.length)];
    }
    return code;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private renderVerificationTemplate(code: string): string {
    const safeCode = this.escapeHtml(code.trim());
    const boxes = safeCode
      .split("")
      .map(
        (char) => `
          <td style="padding:0 4px;">
            <div style="
              width:44px;
              height:52px;
              border:1px solid #d4d9e6;
              border-radius:12px;
              background:#ffffff;
              text-align:center;
              line-height:52px;
              font-size:24px;
              font-weight:700;
              color:#14213d;
              font-family:Segoe UI, Arial, sans-serif;
            ">${char}</div>
          </td>`,
      )
      .join("");

    return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Simulactic Verification Code</title>
  </head>
  <body style="margin:0; padding:0; background:#eef2ff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #d8def0;">
            <tr>
              <td style="padding:30px 28px; background:linear-gradient(135deg, #0f172a, #1d3557); color:#f8fbff; font-family:Segoe UI, Arial, sans-serif;">
                <h1 style="margin:0; font-size:26px; font-weight:700;">Welcome to Galactic API</h1>
                <p style="margin:12px 0 0; font-size:15px; line-height:1.6; color:#e5eaf7;">
                  Your account is almost ready. Enter the verification code below to continue.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 24px 26px;">
                <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                  <tr>${boxes}</tr>
                </table>
                <p style="margin:18px 0 0; text-align:center; font-family:Segoe UI, Arial, sans-serif; color:#52607a; font-size:13px;">
                  This code expires in 30 minutes. If you did not request this, you can ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px 24px; border-top:1px solid #e6eaf4; background:#fafbff; font-family:Segoe UI, Arial, sans-serif;">
                <p style="margin:0; color:#667085; font-size:12px; line-height:1.6;">
                  Need help? Contact support at contact@simulactic.app.<br />
                  For your security, never share this code with anyone.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  async send(to: Email, subject: string, body: string): Promise<void> {
    const code = body.trim();
    const html = this.renderVerificationTemplate(code);
    const text = `Your Simulactic verification code is: ${code}`;

    if (!this.transporter) {
      if (this.isProd) {
        throw ErrorFactory.infra("SHARED.DEPENDENCY_NOT_FOUND", {
          dep: "SMTP transport",
        });
      }

      console.info(`[MAILER] to=${to.toString()} subject="${subject}" body="${text}"`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: to.toString(),
      subject,
      text,
      html,
    });
  }
}
