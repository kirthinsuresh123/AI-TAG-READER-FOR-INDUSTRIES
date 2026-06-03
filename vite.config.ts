
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third parameter '' allows loading variables without the VITE_ prefix.
  // Fixed: Cast process to any to resolve the TypeScript error when accessing cwd() in the Vite config environment.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Injects the API_KEY from .env.local or the system environment
      // Fixed: Cast process to any to ensure environment variables are correctly injected into the client bundle.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || (process as any).env.API_KEY)
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: true
    }
  };
});
