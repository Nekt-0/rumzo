import { cp, mkdir, rm } from 'node:fs/promises';

const files = ['index.html', 'app.js', 'style.css'];
const assets = ['avatar.png', 'avatar-background.png', 'empty-receipts.png', 'receipt.svg', 'compare.svg', 'mark.svg'];

await rm('dist/client', { recursive: true, force: true });
await mkdir('dist/client/assets', { recursive: true });
await Promise.all(files.map(file => cp(`web/${file}`, `dist/client/${file}`)));
await Promise.all(assets.map(file => cp(`assets/${file}`, `dist/client/assets/${file}`)));
