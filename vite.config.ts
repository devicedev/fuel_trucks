import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.FUEL_TRUCKS_API_TARGET || 'http://127.0.0.1:5000';
  return {
    plugins: [react()],
    base: '/static/fuel-trucks/',
    server: {proxy: {'/api': target, '/hub': target, '/fuel-trucks': target}},
    build: {outDir: 'dist', emptyOutDir: true},
  };
});
