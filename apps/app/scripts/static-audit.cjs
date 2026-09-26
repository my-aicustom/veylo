const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let errors = [];
let tsCount = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = path.normalize(`${dir}${path.sep}${name}`);
    const relative = path.relative(root, p);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      errors.push(`${p}: path escaped audit root`);
      continue;
    }
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      tsCount++;
      const source = fs.readFileSync(p, 'utf8');
      const out = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve },
        reportDiagnostics: true,
        fileName: p,
      });
      for (const d of out.diagnostics || []) errors.push(`${p}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    } else if (name.endsWith('.json')) {
      try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { errors.push(`${p}: invalid JSON: ${e.message}`); }
    }
  }
}
walk(root);
const clientFiles = ['app/page.tsx','components/ProfileForm.tsx','lib/client-ai.ts'];
for (const rel of clientFiles) {
  const text = fs.readFileSync(path.join(root, rel),'utf8');
  if (text.includes('OPENROUTER_API_KEY')) errors.push(`${rel}: browser source contains OPENROUTER_API_KEY`);
  if (text.includes('openrouter.ai')) errors.push(`${rel}: browser source calls OpenRouter directly`);
}
const licensePath = fs.existsSync(path.join(root, 'LICENSE'))
  ? path.join(root, 'LICENSE')
  : path.resolve(root, '..', '..', 'LICENSE');
if (!fs.existsSync(licensePath) || !fs.readFileSync(licensePath, 'utf8').includes('Apache License')) {
  errors.push('Apache-2.0 LICENSE missing');
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`STATIC AUDIT PASSED: ${tsCount} TypeScript/TSX files; JSON valid; browser OpenRouter key boundary clean.`);
