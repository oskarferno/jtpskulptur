// Minimal, JTP-branded transactional email templates. Inline styles only —
// email clients strip <style> blocks and external stylesheets unpredictably.
// Colors match src/styles/global.css's palette (--color-ink/-paper/-clay).

import { renderMarkdown } from './markdown';

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const INK = '#1c1a17';
const INK_SOFT = '#55503f';
const PAPER = '#f4efe6';
const LINE = '#d5cab5';
const CLAY = '#7a4a2a';

function wrap(bodyHtml: string, preheaderHtml = ''): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${PAPER};font-family:Georgia,'Iowan Old Style',serif;color:${INK};">
    ${preheaderHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:32px;">
                <span style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};">JTP Skulptur</span>
              </td>
            </tr>
            ${bodyHtml}
            <tr>
              <td style="padding-top:40px;border-top:1px solid ${LINE};margin-top:32px;">
                <p style="font-size:12px;color:${INK_SOFT};font-family:sans-serif;">JTP Skulptur — Jens Wollinger</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function heading(text: string): string {
  return `<tr><td style="padding-bottom:16px;"><h1 style="font-size:24px;font-weight:400;margin:0;">${text}</h1></td></tr>`;
}

function paragraph(text: string): string {
  return `<tr><td style="padding-bottom:16px;"><p style="font-size:15px;line-height:1.6;margin:0;color:${INK_SOFT};font-family:sans-serif;">${text}</p></td></tr>`;
}

function button(label: string, url: string): string {
  return `<tr><td style="padding:8px 0 24px;"><a href="${url}" style="display:inline-block;border:1px solid ${INK};color:${INK};text-decoration:none;padding:10px 24px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;font-family:sans-serif;">${label}</a></td></tr>`;
}

export interface OrderEmailItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface OrderEmailData {
  order_number: string;
  customer_name?: string | null;
  total: number;
  currency: string;
  shipping?: number | null;
  shipping_region?: string | null;
  shipping_address?: Record<string, unknown> | null;
}

const SHIPPING_REGION_LABELS: Record<string, string> = {
  sweden: 'Sweden',
  denmark: 'Denmark',
  norway: 'Norway',
  finland: 'Finland',
  eu: 'EU',
  us: 'United States',
  row: 'Rest of world',
};

function shippingLine(order: OrderEmailData): { label: string; amount: number } | null {
  if (!order.shipping || order.shipping <= 0) return null;
  const region = order.shipping_region ? (SHIPPING_REGION_LABELS[order.shipping_region] ?? order.shipping_region) : null;
  return { label: region ? `Shipping — ${region}` : 'Shipping', amount: order.shipping };
}

function money(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function itemsTable(items: OrderEmailItem[], currency: string, shipping?: { label: string; amount: number } | null): string {
  const itemRows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;font-size:14px;font-family:sans-serif;color:${INK};">${i.product_name} &times; ${i.quantity}</td><td style="padding:6px 0;font-size:14px;font-family:sans-serif;color:${INK_SOFT};text-align:right;">${money(i.unit_price * i.quantity, currency)}</td></tr>`
    )
    .join('');
  const shippingRow = shipping
    ? `<tr><td style="padding:6px 0;font-size:14px;font-family:sans-serif;color:${INK};">${shipping.label}</td><td style="padding:6px 0;font-size:14px;font-family:sans-serif;color:${INK_SOFT};text-align:right;">${money(shipping.amount, currency)}</td></tr>`
    : '';
  const rows = itemRows + shippingRow;
  return `<tr><td style="padding-bottom:16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};">${rows}</table></td></tr>`;
}

export function renderOrderConfirmedEmail(order: OrderEmailData, items: OrderEmailItem[]): EmailContent {
  const subject = `Order confirmed — ${order.order_number}`;
  const shipping = shippingLine(order);
  const html = wrap(
    heading('Thank you for your order') +
      paragraph(
        `Your order <strong>${order.order_number}</strong> has been confirmed. We'll email you again once it ships.`
      ) +
      itemsTable(items, order.currency, shipping) +
      paragraph(`<strong>Total: ${money(order.total, order.currency)}</strong>`)
  );
  const textLines = items.map((i) => `${i.product_name} x${i.quantity} — ${money(i.unit_price * i.quantity, order.currency)}`);
  if (shipping) textLines.push(`${shipping.label} — ${money(shipping.amount, order.currency)}`);
  const text = `Thank you for your order.\n\nOrder ${order.order_number}\n\n${textLines.join('\n')}\n\nTotal: ${money(order.total, order.currency)}`;
  return { subject, html, text };
}

export function renderVendorOrderNotificationEmail(order: OrderEmailData, items: OrderEmailItem[], vendorPortalUrl: string): EmailContent {
  const subject = `New paid order — ${order.order_number}`;
  const html = wrap(
    heading('New order to fulfill') +
      paragraph(`Order <strong>${order.order_number}</strong> has been paid and is ready for fulfillment.`) +
      itemsTable(items, order.currency) +
      button('View in Vendor Portal', vendorPortalUrl)
  );
  const text = `New paid order ${order.order_number}.\n\n${items.map((i) => `${i.product_name} x${i.quantity}`).join('\n')}\n\nView it in the Vendor Portal: ${vendorPortalUrl}`;
  return { subject, html, text };
}

export function renderShippingConfirmedEmail(
  order: OrderEmailData,
  tracking: { trackingNumber?: string | null; trackingUrl?: string | null }
): EmailContent {
  const subject = `Your order has shipped — ${order.order_number}`;
  const trackingHtml = tracking.trackingUrl
    ? button('Track your package', tracking.trackingUrl)
    : tracking.trackingNumber
      ? paragraph(`Tracking number: ${tracking.trackingNumber}`)
      : '';
  const html = wrap(
    heading('Your order has shipped') +
      paragraph(`Order <strong>${order.order_number}</strong> is on its way.`) +
      trackingHtml
  );
  const text = `Order ${order.order_number} has shipped.${tracking.trackingNumber ? `\nTracking: ${tracking.trackingNumber}` : ''}`;
  return { subject, html, text };
}

export function renderNewsletterConfirmEmail(confirmUrl: string): EmailContent {
  const subject = 'Confirm your subscription';
  const html = wrap(
    heading('Confirm your subscription') +
      paragraph('Please confirm you\'d like to receive occasional news from JTP Skulptur.') +
      button('Confirm subscription', confirmUrl)
  );
  const text = `Confirm your subscription to JTP Skulptur's newsletter: ${confirmUrl}`;
  return { subject, html, text };
}

export function renderNewsletterWelcomeEmail(unsubscribeUrl: string): EmailContent {
  const subject = "You're subscribed";
  const html = wrap(
    heading("You're on the list") +
      paragraph("Thank you for subscribing. We'll send occasional updates on new work, exhibitions, and journal entries.") +
      `<tr><td style="padding-top:8px;"><a href="${unsubscribeUrl}" style="font-size:12px;color:${INK_SOFT};font-family:sans-serif;">Unsubscribe</a></td></tr>`
  );
  const text = `You're subscribed to JTP Skulptur's newsletter.\n\nUnsubscribe: ${unsubscribeUrl}`;
  return { subject, html, text };
}

export interface NewsletterEmailData {
  subject: string;
  previewText?: string | null;
  imageUrl?: string | null;
  contentMarkdown: string;
  ctaText?: string | null;
  ctaUrl?: string | null;
}

// Invisible preheader — the line inbox lists show beside/under the subject.
// Padded with zero-width joiners so email clients don't fall back to using
// the newsletter's own first line of visible body text instead.
function preheader(text: string): string {
  const padding = '&#8203;&zwnj;'.repeat(20);
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${text}${padding}</div>`;
}

// The composer stores Markdown, never pre-rendered HTML — this is the one
// place it's turned into HTML, shared by preview/test-send/real-send so all
// three ever show exactly the same rendering.
export function renderNewsletterEmail(data: NewsletterEmailData, unsubscribeUrl: string): EmailContent {
  const contentHtml = renderMarkdown(data.contentMarkdown);

  const imageHtml = data.imageUrl
    ? `<tr><td style="padding-bottom:24px;"><img src="${data.imageUrl}" alt="" style="width:100%;height:auto;display:block;border:0;" /></td></tr>`
    : '';

  const ctaHtml = data.ctaText && data.ctaUrl ? button(data.ctaText, data.ctaUrl) : '';

  const bodyHtml =
    imageHtml +
    `<tr><td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${INK};font-family:sans-serif;">${contentHtml}</td></tr>` +
    ctaHtml +
    `<tr><td style="padding-top:24px;"><a href="${unsubscribeUrl}" style="font-size:12px;color:${INK_SOFT};font-family:sans-serif;">Unsubscribe</a></td></tr>`;

  const html = wrap(heading(data.subject) + bodyHtml, data.previewText ? preheader(data.previewText) : '');

  const text = `${data.subject}\n\n${data.contentMarkdown}${data.ctaText && data.ctaUrl ? `\n\n${data.ctaText}: ${data.ctaUrl}` : ''}\n\nUnsubscribe: ${unsubscribeUrl}`;

  return { subject: data.subject, html, text };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface ContactNotificationData {
  name: string;
  email: string;
  subject: string | null;
  message: string;
  artworkTitle: string | null;
}

// Internal notification to the studio — every visitor-supplied value is
// escaped, since it lands in an HTML email. Reply-To (set by the sender) is
// the visitor, so a plain "Reply" answers them directly.
export function renderContactNotificationEmail(data: ContactNotificationData): EmailContent {
  // Header-bound text: collapse any line breaks so it stays one line.
  const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();
  const subject = `Contact form: ${oneLine(data.subject || `Message from ${data.name}`)}`.slice(0, 200);

  const row = (label: string, valueHtml: string) =>
    `<tr><td style="padding-bottom:12px;font-family:sans-serif;font-size:14px;color:${INK_SOFT};"><strong style="color:${INK};">${label}:</strong> ${valueHtml}</td></tr>`;
  const safeEmail = escapeHtml(data.email);

  const html = wrap(
    heading('New contact message') +
      row('Name', escapeHtml(data.name)) +
      row('Email', `<a href="mailto:${safeEmail}" style="color:${CLAY};">${safeEmail}</a>`) +
      (data.subject ? row('Subject', escapeHtml(data.subject)) : '') +
      (data.artworkTitle ? row('About artwork', escapeHtml(data.artworkTitle)) : '') +
      `<tr><td style="padding:12px 0 24px;font-family:sans-serif;font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;">${escapeHtml(data.message)}</td></tr>` +
      paragraph('Reply to this email to answer the visitor directly.')
  );
  const text = [
    'New contact message',
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    ...(data.subject ? [`Subject: ${data.subject}`] : []),
    ...(data.artworkTitle ? [`About artwork: ${data.artworkTitle}`] : []),
    '',
    data.message,
    '',
    'Reply to this email to answer the visitor directly.',
  ].join('\n');
  return { subject, html, text };
}

export { CLAY };
