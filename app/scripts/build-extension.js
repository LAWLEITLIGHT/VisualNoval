/**
 * build-extension.js — 生成 SillyTavern 扩展产物。
 *
 * 输入: app/src/app.js (正则版主逻辑) + app/src/launcher.css + extension/_bootstrap.js
 * 输出:
 *   - extension/index.js : IIFE(patched app.js)  +  扩展引导(_bootstrap.js)
 *   - extension/style.css : launcher.css（可选样式，overlay 样式由 app 运行时注入）
 *   - manifest.json (仓库根) : SillyTavern 第三方扩展清单
 *
 * 关键补丁: 把 getRawSource() 改成优先读 window.__VNM_SOURCE__（消息原文），
 * 并把 openViewer 暴露成 window.__VNM_openViewer，使扩展可脱离 <content> 正则驱动。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(__dirname, '..', 'src');
const EXT = path.join(ROOT, 'extension');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

let app = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');

// --- 补丁 1: getRawSource 优先用 window.__VNM_SOURCE__ ---
const NEEDLE = "function getRawSource(){\n  const el = document.getElementById('vnm-embedded-source');\n  return el ? (el.textContent || '') : '';\n}";
const PATCHED = "function getRawSource(){\n  try { if (typeof window.__VNM_SOURCE__ === 'string' && window.__VNM_SOURCE__) return window.__VNM_SOURCE__; } catch(e){}\n  const el = document.getElementById('vnm-embedded-source');\n  return el ? (el.textContent || '') : '';\n}";
if (app.indexOf(NEEDLE) === -1) {
  throw new Error('build-extension: 未找到 getRawSource 待补丁锚点，app.js 可能已改动，请同步更新 build-extension.js');
}
app = app.replace(NEEDLE, PATCHED);

// --- 补丁 2: 包成 IIFE 并暴露 openViewer ---
// 注意: 不加 "use strict" —— 原 app.js 是非严格模式代码, 严格模式会导致整段抛错;
// 并用 try/catch 包住, 即使主程序初始化失败, 后面的扩展引导(入口注入)仍能运行。
// 关键: 在主程序体执行(可能抛错的 launcher 绑定)之前, 先利用函数声明提升暴露 openViewer。
// 这样即使后续顶层代码因缺少 launcher DOM 抛错, 阅读器入口已经可用。
const appIife =
  ';try {(function(){\n' +
  'try { window.__VNM_openViewer = openViewer; window.__VNM_app_ready = true; } catch(__pre){ console.warn("[VNM-Ext] 提前暴露失败", __pre); }\n' +
  app +
  '\ntry { window.__VNM_openViewer = openViewer; window.__VNM_app_ready = true; } catch(e){}\n' +
  '})();} catch(__vnmErr){ console.error("[VNM-Ext] app 初始化中断(入口仍可用):", __vnmErr); }\n';

const bootstrap = fs.readFileSync(path.join(EXT, '_bootstrap.js'), 'utf8');

const header =
  '/* Visual Novel (liquid glass) — SillyTavern 扩展打包产物 v' + pkg.version + '\n' +
  ' * 自动生成: app/scripts/build-extension.js  (勿手改; 改源在 app/src/app.js 与 extension/_bootstrap.js)\n' +
  ' */\n';

fs.mkdirSync(EXT, { recursive: true });
fs.writeFileSync(path.join(EXT, 'index.js'), header + appIife + '\n' + bootstrap);

// style.css = launcher.css（运行时 overlay 样式由 app 注入，这里仅带上卡片样式以备用）
fs.writeFileSync(path.join(EXT, 'style.css'), fs.readFileSync(path.join(SRC, 'launcher.css'), 'utf8'));

// manifest.json at repo root
const manifest = {
  display_name: 'Visual Novel (liquid glass)',
  loading_order: 100,
  requires: [],
  optional: [],
  js: 'extension/index.js',
  css: 'extension/style.css',
  author: 'LAWLEITLIGHT',
  version: pkg.version,
  homePage: 'https://github.com/LAWLEITLIGHT/VisualNoval',
  auto_update: true,
};
fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('[build-extension] extension/index.js ->', (header + appIife + bootstrap).length, 'chars');
console.log('[build-extension] manifest.json v' + pkg.version);
