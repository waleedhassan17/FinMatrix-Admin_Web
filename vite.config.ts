import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 5174, not the website's 5173, so the console and the customer site can run
    // side by side. The API allows an origin only if it is listed in
    // CORS_ORIGINS (main.ts), so this port has to be added there — it defaults
    // to '*' when the variable is unset, which is why local dev often works
    // before anyone notices.
    port: 5174,
  },
})
