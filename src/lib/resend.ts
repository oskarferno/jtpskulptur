import { Resend } from 'resend';
import { getEnv } from './env';

let client: Resend | undefined;

function getResendClient(): Resend {
  if (!client) {
    const { RESEND_API_KEY } = getEnv();
    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY');
    }
    client = new Resend(RESEND_API_KEY);
  }
  return client;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Where a plain "Reply" goes — the From address stays the verified sender.
  replyTo?: string;
}

/**
 * Sends a transactional email. Never call this with a recipient or content
 * that came directly from a request body without validation first — this is
 * a trusted-backend-only helper, not a general-purpose mail API.
 */
export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailInput) {
  const { RESEND_FROM_EMAIL } = getEnv();
  if (!RESEND_FROM_EMAIL) {
    throw new Error('Missing RESEND_FROM_EMAIL');
  }
  const resend = getResendClient();
  const { error } = await resend.emails.send({ from: RESEND_FROM_EMAIL, to, subject, html, text, ...(replyTo ? { replyTo } : {}) });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
