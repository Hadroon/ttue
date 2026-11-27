import { config } from "../config/app.config";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Sends an email through the Resend HTTP API. Without RESEND_API_KEY the message is printed
 * to the console instead, so flows can be tested locally. Returns whether delivery succeeded.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!config.email.resendApiKey) {
    if (config.environment === "production") {
      console.error(`RESEND_API_KEY is not set; email "${message.subject}" was not sent`);
      return false;
    }
    console.log(`📧 [email not sent: RESEND_API_KEY missing]\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.email.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!res.ok) {
      console.error(`Resend API error ${res.status}:`, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
