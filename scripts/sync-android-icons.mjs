import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(projectRoot, 'src-tauri', 'icons', 'android');
const destinationDirectory = path.join(
  projectRoot,
  'src-tauri',
  'gen',
  'android',
  'app',
  'src',
  'main',
  'res',
);

await mkdir(destinationDirectory, { recursive: true });
await cp(sourceDirectory, destinationDirectory, { recursive: true, force: true });
