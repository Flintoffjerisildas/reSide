import { fileURLToPath, URL } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const authServiceTarget = env.VITE_AUTH_SERVICE_URL || 'http://localhost:3004';
    const backendTarget = 'http://127.0.0.1:5000';

    return {
        logLevel: 'error',
        build: {
            emptyOutDir: true,
            sourcemap: false,
            minify: false
        },
        css: {
            postcss: './postcss.config.js'
        },
        server: {
            host: '0.0.0.0',
            allowedHosts: ['.github.dev', '.app.github.dev', '.devtunnels.ms'],
            proxy: {
                '/api': {
                    target: backendTarget,
                    changeOrigin: true
                },
                '/socket.io': {
                    target: backendTarget,
                    changeOrigin: true,
                    ws: true
                },
                '/auth-service-proxy': {
                    target: authServiceTarget,
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/auth-service-proxy/, '')
                }
            }
        },
        plugins: [
            react()
        ],
        resolve: {
            alias: [
                {
                    find: '@',
                    replacement: fileURLToPath(new URL('./src', import.meta.url))
                }
            ]
        }
    };
});
