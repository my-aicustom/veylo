import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const appCss = read('apps/app/styles/globals.css');
const callCss = read('apps/app/styles/call-ux.css');
const site = read('apps/site/src/pages/index.astro');
const logo = read('apps/site/src/components/Logo.astro');
const design = read('docs/DESIGN_SYSTEM.md');

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
}

// Accessibility / interaction quality.
check('App has a global :focus-visible treatment', appCss.includes(':focus-visible'));
check('Public site has a :focus-visible treatment', site.includes(':focus-visible'));
check('Secondary app text token clears the prior low-contrast value', appCss.includes('--soft: #777d83;'));
check('Mobile public CTA keeps a 44px square hit area', site.includes('min-width:44px;min-height:44px'));
check('Public logo does not stretch across the mobile grid cell', logo.includes('justify-self:start'));
check('App provides an explicit favicon', fs.existsSync(path.join(root, 'apps/app/app/icon.svg')));\ncheck('Screenshot harness uses dynamic Chrome debugging port', read('scripts/capture-ui-review.mjs').includes("'--remote-debugging-port=0'") && !read('scripts/capture-ui-review.mjs').includes('const port = 9222'));
check('Compact app buttons keep the 44px product touch-target rule', /\.small\s*\{[^}]*min-height:\s*44px/s.test(appCss));
check('Text actions keep the 44px product touch-target rule', /\.text-button\s*\{[^}]*min-height:\s*44px/s.test(appCss));
check('Reduced-motion support exists in public site', site.includes('prefers-reduced-motion'));
check('App exposes disabled state styling', /:disabled\s*\{[^}]*opacity/s.test(appCss));
check('Critical language select uses focus-visible rather than focus-only', callCss.includes('.language-control select:focus-visible'));

// Anti-slop design constraints: Veylo deliberately avoids fashionable decoration
// that does not communicate state or hierarchy.
check('App interpreter avoids glass-blur decoration', !appCss.includes('backdrop-filter'));
check('Public product mock avoids decorative radial gradients', !site.includes('radial-gradient'));
check('Primary public CTA is not a generic pill button', !/\.button\{[^}]*border-radius:\s*999px/s.test(site));
check('Mode-list hover does not shift layout', !site.includes('.mode-row:hover{padding-left'));
check('Mode arrow does not rotate as decoration', !site.includes('transform:rotate(-12deg)'));

// Structural checks aligned to the design system.
check('Design system explicitly rejects decorative dashboards', design.includes('No fake metrics') && design.includes('Cards are used only'));
check('App retains responsive breakpoints', appCss.includes('@media (max-width: 720px)'));
check('Public site retains responsive breakpoints', site.includes('@media(max-width:720px)'));

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
console.log(`\nUI QUALITY: ${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
