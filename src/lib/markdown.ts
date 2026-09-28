import { marked, Renderer } from 'marked';

// Security audit finding M-1: admin-authored Markdown (Journal body,
// Newsletter content) is rendered with set:html. marked does not sanitize
// raw HTML embedded in its input by default — a stray <script> or an
// event-handler attribute typed (or pasted) into an admin textarea would
// execute for every site visitor. This isn't about distrusting the admin
// generally; it's a cheap backstop against exactly that mistake, and
// against a compromised admin session being used for persistent, site-wide
// XSS via this one specific path.
//
// Overriding Renderer.html (the raw-HTML-passthrough hook) to escape
// instead of pass through — rather than pulling in a full DOM-based
// sanitizer such as DOMPurify — keeps this dependency-free and compatible
// with the Cloudflare Workers runtime this app deploys to (no jsdom/DOM API
// available there). Every other Markdown feature — headings, bold, italic,
// links, lists — is completely unaffected; only literal HTML tags typed
// into the source are neutralized, rendered as visible text instead of
// executing.
const renderer = new Renderer();
renderer.html = ({ text }) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderMarkdown(source: string | null | undefined): string {
  return marked.parse(source ?? '', { renderer, async: false }) as string;
}
