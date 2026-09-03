import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': {
        target: 'https://fractaldmsdev.centralindia.cloudapp.azure.com',
        changeOrigin: true,
        secure: false,
      },
      '/core': {
        target: 'https://fractaldmsdev.centralindia.cloudapp.azure.com',
        changeOrigin: true,
        secure: false,
      },
      '/analytics-query': {
        target: 'https://fractaldmsdev.centralindia.cloudapp.azure.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
