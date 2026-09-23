import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'apps/site/src/pages/index.astro',
  'apps/site/package.json',
  'apps/app/app/rooms/[roomName]/room-page-client.tsx',
  'apps/app/app/api/connection-details/route.ts',
  'apps/app/lib/ai/openrouter.ts',
  'infra/livekit.yaml',
  'BRAND_STATUS.md',
  'docs/DESIGN_SYSTEM.md',
  'docs/COPY_GUIDE.md',
];
let failed = false;
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) { console.error('MISSING', rel); failed = true; }
}
const browserSurface = [
  path.join(root, 'apps/site'),
  path.join(root, 'apps/app/components'),
].filter(fs.existsSync);
for (const dir of browserSurface) {
  const stack=[dir];
  while(stack.length){
    const current=stack.pop();
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const p=path.join(current,entry.name);
      if(entry.isDirectory()) stack.push(p);
      else if(/\.(astro|tsx?|jsx?)$/.test(entry.name)){
        const s=fs.readFileSync(p,'utf8');
        if(s.includes('OPENROUTER_API_KEY')) { console.error('SECRET BOUNDARY RISK', path.relative(root,p)); failed=true; }
      }
    }
  }
}
console.log(`Static project audit: ${failed ? 'FAILED' : 'PASSED'}`);
process.exit(failed ? 1 : 0);
