import fs from 'node:fs';
import path from 'node:path';
import { validateProductionEnv, validateRepository } from './readiness-lib.mjs';

function parseEnv(text) {
  const env = {};
  const normalized = text.replaceAll('\r\n', '\n');
  for (const raw of normalized.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const root = process.cwd();
const templateOnly = process.argv.includes('--template');
const repoErrors = validateRepository(root);

if (templateOnly) {
  if (repoErrors.length) {
    console.error('PRODUCTION TEMPLATE CHECK FAILED');
    for (const error of repoErrors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('PRODUCTION TEMPLATE CHECK PASSED');
  process.exit(0);
}

const envFlag = process.argv.indexOf('--env');
const envPath = envFlag >= 0 && process.argv[envFlag + 1]
  ? path.resolve(root, process.argv[envFlag + 1])
  : path.resolve(root, '.env.production');

if (!fs.existsSync(envPath)) {
  console.error(`Production env file not found: ${envPath}`);
  console.error('Use: pnpm readiness -- --env path/to/.env.production');
  process.exit(1);
}

const fileEnv = parseEnv(fs.readFileSync(envPath, 'utf8'));
const errors = [...repoErrors, ...validateProductionEnv({ ...fileEnv, ...process.env })];

if (errors.length) {
  console.error('PRODUCTION READINESS FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('PRODUCTION READINESS PASSED');
console.log(`Validated environment: ${envPath}`);
