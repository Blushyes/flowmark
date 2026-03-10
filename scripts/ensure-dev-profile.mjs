import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const profileDir = resolve('.wxt/chromium-profile');

await mkdir(profileDir, { recursive: true });
