import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const root = new URL('../', import.meta.url)
const names = ['manifest.json', 'compat.js', 'worker.mjs', 'runner.mjs', 'health.js', 'myship.js', 'README.md']
const parts = {}
for (const name of names) parts[`myship-assistant/${name}`] = new Uint8Array(await readFile(new URL(`extensions/myship-assistant/${name}`, root)))
const manifest = JSON.parse(Buffer.from(parts['myship-assistant/manifest.json']).toString('utf8'))
const destination = new URL(`public/downloads/myship-assistant-${manifest.version}.zip`, root)
await mkdir(new URL('public/downloads/', root), { recursive: true })
await writeFile(destination, zipSync(parts))
console.log(`Packaged ${names.length} files: ${fileURLToPath(destination)}`)
