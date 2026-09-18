#!/usr/bin/env node
/**
 * Fails the build on hardcoded type or colour in the UI.
 *
 * Ported from the app's scripts/check-design-tokens.js. It matters more here
 * than it did there: this console and the mobile app are used side by side by
 * the same company, so a colour written by hand in one of them is a place where
 * the two products visibly disagree. Without a gate, that drift is inevitable —
 * it is always faster to type a hex than to look up the token.
 *
 * What it bans across src/, in .ts and .tsx:
 *   '#0F766E' / "#0F766E"    -> a colour token          (colors.primary)
 *   bg-[#1F4E79]             -> a themed utility        (bg-primary)
 *   text-[22px]              -> a typography role       (text-h2)
 *   fontSize: 14             -> a typography role
 *   fontWeight: 600          -> a role
 *   fontFamily: 'Roboto'     -> FONT_STACK / the font-sans utility
 *
 * Tailwind's NAMED weight utilities (font-medium, font-normal…) are allowed:
 * the summary panel legitimately renders an h5 role at body weight, and the app
 * does the same. It is the *values* that must come from the system, not every
 * adjustment to them.
 *
 * ALLOWED lists the files that define tokens rather than consume them. Each
 * needs a reason.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src'];

const ALLOWED = new Map([
  ['src/theme/tokens.ts', 'defines the palette, type scale and elevation'],
  ['src/theme/status.ts', 'defines the status tiers'],
]);

const RULES = [
  {
    re: /'#[0-9A-Fa-f]{3,8}'/g,
    msg: 'hardcoded colour — use a colour token',
  },
  {
    // Both quote styles. Matching only single quotes lets every JSX attribute
    // through, which is exactly how off-system colours reach a codebase.
    re: /"#[0-9A-Fa-f]{3,8}"/g,
    msg: 'hardcoded colour — use a colour token',
  },
  {
    // Tailwind arbitrary colour: bg-[#1F4E79], text-[#DC2626], border-[#...].
    // These hide inside a quoted className, so the two rules above miss them.
    re: /\[#[0-9A-Fa-f]{3,8}\]/g,
    msg: 'hardcoded colour in a Tailwind arbitrary value — use a themed utility',
  },
  {
    // Tailwind arbitrary type size: text-[22px], text-[1.375rem].
    re: /\btext-\[\d*\.?\d+(px|rem|em)\]/g,
    msg: 'hardcoded font size — use a typography role (text-h2, text-body-md…)',
  },
  {
    re: /fontSize:\s*\d/g,
    msg: 'hardcoded fontSize — use a typography role',
  },
  {
    re: /fontWeight:\s*['"]?\d00['"]?/g,
    msg: 'hardcoded fontWeight — use a typography role',
  },
  {
    re: /fontFamily:\s*['"][^'"]+['"]/g,
    msg: 'hardcoded fontFamily — use FONT_STACK or the font-sans utility',
  },
  {
    // The one that actually shipped broken. Tailwind resolves a width or height
    // utility against --max-width, then --spacing, then --container — spacing
    // BEFORE container. Our spacing scale is t-shirt sized, so `max-w-sm` is
    // not 24rem, it is `var(--spacing-sm)` = 12px, and no build step complains:
    // the class exists, the CSS is valid, the sign-in form is 12px wide.
    //
    // The whole t-shirt range is therefore unusable as a width. Sizes come from
    // the `measure` scale (max-w-form, -card, -panel, -dialog, -copy), which is
    // named outside that range precisely so it cannot collide.
    re: /\b(?:max-w|min-w|w|max-h|min-h|h|basis)-(?:3xs|2xs|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|xxs|xxl|xxxl|xxxxl)\b/g,
    msg:
      't-shirt size on a width/height utility — it silently resolves to the ' +
      'spacing scale (max-w-sm = 12px). Use a measure token: max-w-form, ' +
      'max-w-card, max-w-panel, max-w-dialog, max-w-copy.',
  },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'assets') walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The CSS half of the measure invariant.
 *
 * tokens.ts declares `measure` and index.css projects it as --container-*. The
 * names must not also exist under --spacing-*, because Tailwind reads spacing
 * first and a shadowed measure silently becomes a padding value — `max-w-form`
 * would resolve to 4px as readily as `max-w-sm` resolves to 12px.
 *
 * Checked here rather than in a vitest suite because Vite stubs CSS imports in
 * the node test environment: `import css from './index.css?raw'` hands back an
 * empty string, and every assertion over it passes without reading anything.
 */
function checkMeasureScale(findings) {
  const cssPath = 'src/index.css';
  const tokensPath = 'src/theme/tokens.ts';
  if (!fs.existsSync(cssPath) || !fs.existsSync(tokensPath)) return;

  const css = fs.readFileSync(cssPath, 'utf8');
  const names = (ns) =>
    new Set(
      [...css.matchAll(new RegExp(`^\\s*--${ns}-([a-z0-9-]+):`, 'gm'))].map(
        (m) => m[1],
      ),
    );
  const containers = names('container');
  const spacings = names('spacing');

  for (const name of containers) {
    if (spacings.has(name)) {
      findings.push({
        file: cssPath,
        line: css.split('\n').findIndex((l) => l.includes(`--container-${name}:`)) + 1,
        msg: `--container-${name} is shadowed by --spacing-${name} — Tailwind reads spacing first, so max-w-${name} silently becomes the spacing value`,
        text: `--container-${name}`,
      });
    }
  }

  // tokens.ts is the source of truth; index.css is its projection. Drift here
  // means TypeScript and the stylesheet disagree about how wide something is.
  const block = /export const measure = \{([\s\S]*?)\n\} as const;/.exec(
    fs.readFileSync(tokensPath, 'utf8'),
  );
  if (!block) return;
  for (const [, key, px] of block[1].matchAll(/^\s*([a-z][a-zA-Z0-9]*):\s*(\d+),/gm)) {
    const declared = new RegExp(`^\\s*--container-${key}:\\s*([\\d.]+)rem;`, 'm').exec(css);
    if (!declared) {
      findings.push({
        file: tokensPath,
        line: 0,
        msg: `measure.${key} has no --container-${key} in ${cssPath}`,
        text: `${key}: ${px}`,
      });
    } else if (Number(declared[1]) * 16 !== Number(px)) {
      findings.push({
        file: cssPath,
        line: 0,
        msg: `--container-${key} is ${Number(declared[1]) * 16}px but measure.${key} is ${px}px`,
        text: `--container-${key}: ${declared[1]}rem`,
      });
    }
  }
}

const findings = [];
checkMeasureScale(findings);
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    if (ALLOWED.has(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // A commented-out line is not shipped code.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const { re, msg } of RULES) {
        re.lastIndex = 0;
        if (re.test(line)) {
          findings.push({ file, line: i + 1, msg, text: line.trim() });
        }
      }
    });
  }
}

if (findings.length === 0) {
  console.log('Design tokens: clean.');
  process.exit(0);
}

console.error(`Design tokens: ${findings.length} hardcoded value(s).\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.msg}`);
  console.error(`    ${f.text.slice(0, 100)}`);
}
console.error(
  '\nEvery value comes from src/theme/tokens.ts. See the ROLE MAP comment there\n' +
    'for which token a given piece of UI takes. If a value genuinely belongs\n' +
    'outside the system, add the file to ALLOWED in this script with a reason.',
);
process.exit(1);
