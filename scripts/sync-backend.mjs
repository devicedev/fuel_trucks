import {cp, mkdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.resolve(process.argv[2] || path.join(root, '../DBAnalit-clean'));
await stat(path.join(backend, 'app.py'));
await stat(path.join(backend, 'backend/fuel_trucks'));
const dist = path.join(root, 'dist');
await readFile(path.join(dist, 'index.html'), 'utf8');
const target = path.join(backend, 'static/fuel-trucks');
await mkdir(target, {recursive: true});
await cp(dist, target, {recursive: true});
console.log(`Fuel Trucks build copied to ${target}`);
