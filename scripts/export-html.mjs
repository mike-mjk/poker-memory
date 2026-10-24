import { readFile, writeFile } from 'node:fs/promises';

// Package the built app into one portable file, without server-relative assets.
const directory = new URL('../dist/', import.meta.url);
let html = await readFile(new URL('index.html', directory), 'utf8');
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/);
if (!script || !stylesheet) throw new Error('Expected one Vite JavaScript bundle and stylesheet.');
const assetURL = path => new URL(path.replace(/^\//, ''), directory);
const js = await readFile(assetURL(script[1]), 'utf8');
const css = await readFile(assetURL(stylesheet[1]), 'utf8');
html = html.replace(script[0], () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
// Classic inline JavaScript must run after the app container exists.
const inlineScript = html.match(/<script>[\s\S]*?<\/script>/)[0];
html = html.replace(inlineScript, '').replace('</body>', () => `${inlineScript}\n</body>`);
await writeFile(new URL('poker-memory.html', directory), html);
console.log('Standalone browser version: dist/poker-memory.html');
