import { URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const DEV_PAGE_IMAGE_PROXY_PATH = '/__n-mgram-image';
const PAGE_IMAGE_HOST_SUFFIX = 'ihlv1.xyz';
const MAX_PAGE_IMAGE_BYTES = 32 * 1024 * 1024;

function getProxiedPageImage(requestPath: string | undefined): URL | undefined {
  if (!requestPath) return undefined;
  const requested = new URL(requestPath, 'http://localhost').searchParams.get('url');
  if (!requested) return undefined;
  try {
    const target = new URL(requested);
    if (
      target.protocol !== 'https:' ||
      (target.hostname !== PAGE_IMAGE_HOST_SUFFIX &&
        !target.hostname.endsWith(`.${PAGE_IMAGE_HOST_SUFFIX}`))
    ) {
      return undefined;
    }
    return target;
  } catch {
    return undefined;
  }
}

function pageImageProxyPlugin(): Plugin {
  return {
    name: 'n-mgram-page-image-proxy',
    configureServer(server) {
      server.middlewares.use(DEV_PAGE_IMAGE_PROXY_PATH, (request, response) => {
        const target = getProxiedPageImage(request.url);
        if (!target) {
          response.statusCode = 400;
          response.end('Invalid page image URL');
          return;
        }

        void fetch(target, {
          headers: {
            Accept: 'image/*',
            Referer: 'https://lovehug.net',
            'x-app-sdk-version': '54.0.0',
            'x-app-version': '5.0.0',
          },
          signal: AbortSignal.timeout(20_000),
        })
          .then(async (upstream) => {
            response.statusCode = upstream.status;
            for (const header of ['cache-control', 'content-type']) {
              const value = upstream.headers.get(header);
              if (value) response.setHeader(header, value);
            }
            if (!upstream.ok || upstream.body === null) {
              response.end();
              return;
            }

            const declaredSize = Number(upstream.headers.get('content-length') ?? 0);
            if (declaredSize > MAX_PAGE_IMAGE_BYTES) {
              response.statusCode = 413;
              response.end();
              return;
            }

            const reader = upstream.body.getReader();
            const chunks: Uint8Array[] = [];
            let receivedSize = 0;
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              receivedSize += chunk.value.byteLength;
              if (receivedSize > MAX_PAGE_IMAGE_BYTES) {
                await reader.cancel();
                response.statusCode = 413;
                response.end();
                return;
              }
              chunks.push(chunk.value);
            }
            response.setHeader('content-length', receivedSize);
            response.end(
              Buffer.concat(
                chunks.map((chunk) => Buffer.from(chunk)),
                receivedSize,
              ),
            );
          })
          .catch((error: unknown) => {
            server.config.logger.error(
              `Page image proxy failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            if (!response.headersSent) response.statusCode = 502;
            response.end();
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), pageImageProxyPlugin()],
  clearScreen: false,
  optimizeDeps: {
    exclude: ['page-flip-2'],
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'chrome105',
    minify: 'oxc',
    sourcemap: false,
  },
});
