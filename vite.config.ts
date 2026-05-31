/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

function getPlugins() {
  const plugins = [
    react(),
    tsconfigPaths(),
    {
      name: 'redirect-root',
      configureServer(server: any) {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (req.url === '/sportsreg') {
            res.writeHead(301, { Location: '/sportsreg/' });
            res.end();
            return;
          }
          next();
        });
      }
    }
  ];
  return plugins;
}

export default defineConfig({
  plugins: getPlugins(),
  base: '/sportsreg/',
  server: {
    proxy: {
      '/sportsreg/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      '/sportsreg/images': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      '/sportsreg/banner': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      '/sportsreg/face': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      }
    }
  }
});
