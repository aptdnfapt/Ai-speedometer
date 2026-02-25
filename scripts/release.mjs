#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const PUBLISHABLE = [
  'packages/ai-speedometer',
  'packages/ai-speedometer-headless',
]

function readJson(p) {
  return JSON.parse(readFileSync(resolve(root, p, 'package.json'), 'utf8'))
}

function writeJson(p, data) {
  writeFileSync(resolve(root, p, 'package.json'), JSON.stringify(data, null, 2) + '\n')
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number)
  if (type === 'major') return `${major + 1}.0.0`
  if (type === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

const bumpType = process.argv[2] || 'patch'
if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('Usage: node scripts/release.mjs [major|minor|patch]')
  process.exit(1)
}

const currentVersion = readJson(PUBLISHABLE[0]).version
const newVersion = bumpVersion(currentVersion, bumpType)

console.log(`Bumping ${currentVersion} → ${newVersion} (${bumpType})`)

const ALL_PACKAGES = ['packages/core', ...PUBLISHABLE]
for (const pkg of ALL_PACKAGES) {
  const json = readJson(pkg)
  json.version = newVersion
  writeJson(pkg, json)
  console.log(`  updated ${pkg}/package.json`)
}

console.log('\nBuilding all packages...')
execSync('bun run build', { cwd: root, stdio: 'inherit' })

console.log('\nPublishing...')
for (const pkg of PUBLISHABLE) {
  console.log(`  publishing ${pkg}...`)
  execSync('npm publish --access public', { cwd: resolve(root, pkg), stdio: 'inherit' })
}

console.log(`\nDone! Published v${newVersion}`)
