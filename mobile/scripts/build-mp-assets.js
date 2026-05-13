#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const OUT_DIR = path.join(ROOT, 'dist', 'mp-assets');

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  ensureDir(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else copyFile(src, dest);
  }
}

function copyIfExists(from, to) {
  if (fs.existsSync(from)) copyFile(from, to);
}

resetDir(OUT_DIR);

const appIcon = path.join(ROOT, 'assets', 'app', 'icon.png');
const darkGoldDir = path.join(ROOT, 'assets', 'skins', 'dark-gold');
const roleDir = path.join(ROOT, 'assets', 'roles', 'core');
const uiNavDir = path.join(ROOT, 'assets', 'ui', 'nav');
const uiActionsDir = path.join(ROOT, 'assets', 'ui', 'actions');
const medalDir = path.join(ROOT, 'miniprogram', 'assets', 'medals');
const aiAvatarDir = path.join(ROOT, 'mp-assets-source', 'ai-avatars');
const skinSourceDir = path.join(ROOT, 'mp-assets-source', 'skins');
const researchDir = path.join(REPO_ROOT, 'ai-research', 'Avalon-NLU', 'docs', 'static', 'assets');

copyIfExists(appIcon, path.join(OUT_DIR, 'icon.png'));
copyIfExists(path.join(darkGoldDir, 'home-bg-optimized.jpg'), path.join(OUT_DIR, 'home-bg-optimized.jpg'));
copyIfExists(path.join(darkGoldDir, 'in-game-bg-optimized.jpg'), path.join(OUT_DIR, 'in-game-bg-optimized.jpg'));
copyIfExists(path.join(darkGoldDir, 'table.png'), path.join(OUT_DIR, 'table.png'));
copyIfExists(path.join(darkGoldDir, 'quest-success-420x300.png'), path.join(OUT_DIR, 'quest-success-420x300.png'));
copyIfExists(path.join(darkGoldDir, 'quest-failed-420x300.png'), path.join(OUT_DIR, 'quest-failed-420x300.png'));

const roleMap = {
  'merlin.png': 'merlin.png',
  'percival.png': 'percival.png',
  'arthur-loyal.png': 'arthur_loyal.png',
  'lancelot-good.png': 'lancelot_good.png',
  'assassin.png': 'assassin.png',
  'morgana.png': 'morgana.png',
  'mordred.png': 'mordred.png',
  'oberon.png': 'oberon.png',
  'minion.png': 'minion.png',
  'lancelot-evil.png': 'lancelot_evil.png',
};
for (const [srcName, destName] of Object.entries(roleMap)) {
  copyIfExists(path.join(roleDir, srcName), path.join(OUT_DIR, 'role-split', destName));
}

copyIfExists(path.join(uiActionsDir, 'kill.png'), path.join(OUT_DIR, 'ui-icons', 'kill.png'));
copyIfExists(path.join(uiNavDir, 'history-scroll.png'), path.join(OUT_DIR, 'ui-icons', 'history_scroll.png'));
copyIfExists(path.join(uiNavDir, 'stats-bars.png'), path.join(OUT_DIR, 'ui-icons', 'stats_bars.png'));

copyDir(medalDir, path.join(OUT_DIR, 'medals'));
copyDir(aiAvatarDir, path.join(OUT_DIR, 'ai-avatars'));

if (fs.existsSync(skinSourceDir)) {
  for (const skinId of fs.readdirSync(skinSourceDir)) {
    const runtimeDir = path.join(skinSourceDir, skinId, 'runtime');
    if (fs.existsSync(runtimeDir)) {
      copyDir(runtimeDir, path.join(OUT_DIR, 'skins', skinId));
    }
  }
}

copyIfExists(path.join(researchDir, 'game_states.png'), path.join(OUT_DIR, 'research', 'game_states.png'));
copyIfExists(path.join(researchDir, 'role_prediction.png'), path.join(OUT_DIR, 'research', 'role_prediction.png'));
copyIfExists(path.join(researchDir, 'chat_example.png'), path.join(OUT_DIR, 'research', 'chat_example.png'));

console.log(`Built mp-assets at ${OUT_DIR}`);
