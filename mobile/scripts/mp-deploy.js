#!/usr/bin/env node
/**
 * 小程序自动化部署脚本
 *
 * 用法：
 *   node scripts/mp-deploy.js upload  1.0.2 "描述"   # 上传到草稿箱
 *   node scripts/mp-deploy.js review  1.0.2 "描述"   # 上传 + 提交审核
 *   node scripts/mp-deploy.js release                 # 审核通过后发布上线
 *   node scripts/mp-deploy.js status                  # 查询最新审核状态
 *
 * 依赖文件（已加入 .gitignore）：
 *   scripts/mp-upload.key   — 微信开放平台代码上传密钥
 */

// Node.js v22+ 内置了 localStorage，子进程继承后 getItem 会报错
// 通过 NODE_OPTIONS --require 把 polyfill 注入到主进程和所有子进程
const polyfillPath = require('path').join(__dirname, 'mp-ls-polyfill.js');
const existing = process.env.NODE_OPTIONS || '';
if (!existing.includes('mp-ls-polyfill')) {
  process.env.NODE_OPTIONS = `--require ${polyfillPath} ${existing}`.trim();
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, process.argv.slice(1), {
    env: process.env,
    stdio: 'inherit',
  });
  process.exit(result.status ?? 0);
}
require(polyfillPath);

const ci = require('miniprogram-ci');
const path = require('path');
const fs = require('fs');
const https = require('https');

const KEY_PATH = path.join(__dirname, 'mp-upload.key');
const PROJECT_PATH = path.join(__dirname, '../miniprogram');
const APPID = 'wx36dffdc5bee2578f';
const APPSECRET = 'ed859c288036262073f12be68e768335';

const { execSync } = require('child_process');

const cmd = process.argv[2] || 'upload';

// ─── 版本 & 描述自动生成 ────────────────────────────────────────────────────────

const VERSION_FILE = path.join(__dirname, '.mp-version');

function getNextVersion() {
  // 手动传入则直接用
  if (process.argv[3] && /^\d+\.\d+\.\d+$/.test(process.argv[3])) return process.argv[3];
  // 否则读本地版本文件自动递增 patch
  if (fs.existsSync(VERSION_FILE)) {
    const [major, minor, patch] = fs.readFileSync(VERSION_FILE, 'utf8').trim().split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }
  return '1.0.0';
}

function getDesc() {
  if (process.argv[4]) return process.argv[4];
  if (process.argv[3] && !/^\d+\.\d+\.\d+$/.test(process.argv[3])) return process.argv[3];
  try {
    // 读取上次部署后的 git commits（只取 miniprogram/ 目录的改动）
    const lastVersion = fs.existsSync(VERSION_FILE) ? fs.readFileSync(VERSION_FILE, 'utf8').trim() : null;
    const sinceTag = lastVersion ? `mp-v${lastVersion}` : 'HEAD~10';
    let logs;
    try {
      logs = execSync(`git log ${sinceTag}..HEAD --oneline -- miniprogram/ mobile/miniprogram/ 2>/dev/null`, {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf8',
      }).trim();
    } catch {
      logs = execSync('git log --oneline -8 -- miniprogram/ mobile/miniprogram/ 2>/dev/null', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf8',
      }).trim();
    }
    if (!logs) return `更新于 ${new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    // 把 commit message 整理成一行摘要（去掉 hash，最多 100 字）
    const lines = logs.split('\n').map(l => l.replace(/^[a-f0-9]+ /, '').replace(/^(fix|feat|chore|style)\([^)]+\): /, '')).filter(Boolean);
    const summary = lines.slice(0, 4).join('；');
    return summary.length > 100 ? summary.slice(0, 97) + '...' : summary;
  } catch {
    return `更新于 ${new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
  }
}

const version = getNextVersion();
const desc = getDesc();

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function wxRequest(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path: urlPath,
      method: body ? 'POST' : 'GET',
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (json.errcode && json.errcode !== 0) reject(new Error(`微信 API 错误 ${json.errcode}: ${json.errmsg}`));
          else resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getAccessToken() {
  const res = await wxRequest(
    `/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
  );
  return res.access_token;
}

// ─── 上传 ─────────────────────────────────────────────────────────────────────

async function upload() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error('❌ 找不到上传密钥：scripts/mp-upload.key');
    process.exit(1);
  }
  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: PROJECT_PATH,
    privateKeyPath: KEY_PATH,
    ignores: ['node_modules/**/*'],
  });
  console.log(`🚀 上传小程序 v${version}  "${desc}"`);
  await ci.upload({
    project, version, desc,
    setting: { useProjectConfig: true },
    onProgressUpdate: (task) => {
      if (task._msg) process.stdout.write(`\r   ${task._msg}    `);
    },
  });
  console.log('\n✅ 上传成功，已进入草稿箱');
  // 保存版本号，打 git tag 方便下次计算 diff
  fs.writeFileSync(VERSION_FILE, version);
  try {
    execSync(`git tag mp-v${version} 2>/dev/null || true`, { cwd: path.join(__dirname, '../..') });
  } catch {}
}

// ─── 提交审核 ─────────────────────────────────────────────────────────────────

async function submitReview() {
  console.log('📋 获取 access_token...');
  const token = await getAccessToken();
  console.log('📋 提交审核...');
  const res = await wxRequest(`/wxa/submit_audit?access_token=${token}`, {
    item_list: [{
      address: 'pages/index/index',
      tag: '阿瓦隆联机',
      first_class: '工具', first_id: 96,
      second_class: '效率', second_id: 98,
      title: '阿瓦隆联机',
    }],
  });
  console.log(`✅ 审核已提交，auditId: ${res.auditid}`);
  console.log('   审核通常需要 1-7 个工作日');
  console.log('   通过后运行：npm run mp:release');
  // 保存 auditId 供后续查询
  fs.writeFileSync(path.join(__dirname, '.mp-auditid'), String(res.auditid));
}

// ─── 查询审核状态 ─────────────────────────────────────────────────────────────

async function checkStatus() {
  const token = await getAccessToken();
  const auditIdFile = path.join(__dirname, '.mp-auditid');
  let auditid = process.argv[3];
  if (!auditid && fs.existsSync(auditIdFile)) auditid = fs.readFileSync(auditIdFile, 'utf8').trim();
  if (!auditid) { console.error('❌ 没有 auditId，请先提交审核'); process.exit(1); }
  const res = await wxRequest(`/wxa/get_auditstatus?access_token=${token}&auditid=${auditid}`);
  const statusMap = { 0: '✅ 审核通过', 1: '❌ 审核失败', 2: '⏳ 审核中' };
  console.log(`审核状态：${statusMap[res.status] || res.status}`);
  if (res.status === 1) console.log(`失败原因：${res.reason}`);
  if (res.status === 0) console.log('可以运行：npm run mp:release');
  return res.status;
}

// ─── 发布上线 ─────────────────────────────────────────────────────────────────

async function release() {
  const token = await getAccessToken();
  console.log('🚀 发布上线...');
  await wxRequest(`/wxa/release?access_token=${token}`, {});
  console.log('✅ 发布成功，小程序已上线！');
}

// ─── 入口 ─────────────────────────────────────────────────────────────────────

async function main() {
  if (cmd === 'upload') {
    await upload();
  } else if (cmd === 'review') {
    await upload();
    await submitReview();
  } else if (cmd === 'status') {
    await checkStatus();
  } else if (cmd === 'release') {
    const status = await checkStatus();
    if (status !== 0) { console.error('❌ 审核尚未通过，无法发布'); process.exit(1); }
    await release();
  } else {
    console.error(`未知命令：${cmd}`);
    console.error('可用命令：upload | review | status | release');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ 失败：', err.message || err);
  process.exit(1);
});
