// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://jtpskulptur.com',
  output: 'server',
  vite: {
    plugins: [tailwindcss()]
  },

  adapter: cloudflare(),

  image: {
    domains: ['ydhdpaddjonoavfouijv.supabase.co'],
  },

  env: {
    schema: {
      PUBLIC_SUPABASE_URL: envField.string({ context: 'server', access: 'public' }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: 'server', access: 'public' }),
      // The one override that flips every outbound absolute URL (canonical
      // tags, OG/JSON-LD, sitemap entries, transactional email links) from
      // "whatever host is actually serving this request" to the real
      // production domain — see src/lib/site-url.ts. Left unset in every
      // environment until jtpskulptur.com actually goes live; deliberately
      // NOT the same thing as the `site` field below, which Astro uses for
      // its own internals and stays a static build-time declaration.
      PUBLIC_SITE_URL: envField.string({ context: 'server', access: 'public', optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      STRIPE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      STRIPE_WEBHOOK_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_FROM_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});