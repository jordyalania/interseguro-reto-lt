import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Solo para `npm run dev`. En Docker, nginx hace este mismo enrutamiento.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1/routes': 'http://127.0.0.1:3012',
      '/api/v1': 'http://127.0.0.1:3011',
    },
  },
});
