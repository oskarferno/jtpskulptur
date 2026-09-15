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

  env: {
    schema: {
      PUBLIC_SUPABASE_URL: envField.string({ context: 'server', access: 'public' }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: 'server', access: 'public' }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});