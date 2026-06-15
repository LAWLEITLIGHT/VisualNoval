/**
 * build-loader.js — 把 loader/vn-loader.js 注入仓库名后，包装成可导入酒馆的
 * 酒馆助手脚本 JSON: loader/酒馆助手脚本-Visual Novel liquidglass（自动更新）.json
 *
 * 仓库名来源(优先级): 环境变量 VNLG_REPO  >  app/package.json 的 "repository" 字段
 * 用法: VNLG_REPO=owner/repo node app/scripts/build-loader.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const repo =
  process.env.VNLG_REPO ||
  (pkg.repository && (pkg.repository.url || pkg.repository)) ||
  'OWNER/visual-novel-liquidglass';

const cleanRepo = String(repo)
  .replace(/^git\+/, '')
  .replace(/^https?:\/\/github\.com\//, '')
  .replace(/\.git$/, '')
  .replace(/\/+$/, '');

const loaderJs = fs
  .readFileSync(path.join(ROOT, 'loader', 'vn-loader.js'), 'utf8')
  .replace('__REPOSITORY__', cleanRepo);

const scriptJson = {
  type: 'script',
  enabled: false,
  name: 'Visual Novel liquidglass（自动更新）',
  id: 'vnlg-auto-update-loader-0001',
  content: loaderJs,
  info:
    'Visual Novel (liquid glass) 自动更新 loader。\n' +
    '启动时从 GitHub(' + cleanRepo + ') 拉取最新正则并装入全局正则。\n' +
    '使用前请确认仓库为公开可访问。',
  button: { enabled: false, buttons: [] },
  data: {},
  export_with: { data: true, button: true },
};

const outName = 'loader/酒馆助手脚本-Visual Novel liquidglass（自动更新）.json';
const outPath = path.join(ROOT, outName);
fs.writeFileSync(outPath, JSON.stringify(scriptJson, null, 2));
// 同时写一个固定文件名，便于自动化反解校验
fs.writeFileSync(path.join(ROOT, 'loader', 'vn-loader.json'), JSON.stringify(scriptJson, null, 2));
console.log('[build-loader] repo =', cleanRepo);
console.log('[build-loader] ->', outName);
