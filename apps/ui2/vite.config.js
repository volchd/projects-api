import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/projects': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/tasks': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
});
