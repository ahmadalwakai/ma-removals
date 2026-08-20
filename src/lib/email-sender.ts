import { resend } from "./resend";

const FROM = "MA Removals <bookings@maremovals.co.uk>";
const REPLY_TO = "info@maremovals.co.uk";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — email not sent:", params.subject);
    return;
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo ?? REPLY_TO,
    });
  } catch (error) {
    console.error("Email send failed:", error);
    // Don't throw — email failure should not break the main flow
  }
}
