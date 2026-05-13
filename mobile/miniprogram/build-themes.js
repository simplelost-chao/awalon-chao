#!/usr/bin/env node
// build-themes.js — run manually: node build-themes.js
// Regenerates the .theme-xxx CSS blocks in app.wxss from skins.js vars.
// ⚠️  Do NOT edit the GENERATED section of app.wxss directly — edit skins.js instead.

const fs = require('fs');
const path = require('path');
const { SKINS } = require('./skins');

const WXSS_PATH = path.join(__dirname, 'app.wxss');
let content = fs.readFileSync(WXSS_PATH, 'utf8');

const blocks = SKINS
  .filter(s => s.id !== 'dark-gold') // dark-gold is the page {} default
  .map(skin => {
    if (!skin.vars) return '';
    const varLines = Object.entries(skin.vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    return `.${skin.cssClass} {\n${varLines}\n}`;
  })
  .filter(Boolean)
  .join('\n\n');

const START = '/* ──GENERATED-THEMES-START── */';
const END   = '/* ──GENERATED-THEMES-END── */';
const replacement = `${START}\n/* ⚠️  Edit skins.js vars then run: node build-themes.js */\n\n${blocks}\n\n${END}`;

if (content.includes(START) && content.includes(END)) {
  content = content.replace(new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`), replacement);
} else {
  console.error('Sentinel comments not found in app.wxss. Add them manually first.');
  process.exit(1);
}

fs.writeFileSync(WXSS_PATH, content, 'utf8');
console.log('✓ Theme blocks regenerated in app.wxss');
