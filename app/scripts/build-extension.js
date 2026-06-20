/**
 * build-extension.js — 生成 SillyTavern 扩展产物（iframe 注入式，忠实复刻正则运行环境）。
 *
 * 思路：扩展不在全局跑 app.js，而是把你原始正则的 HTML 整体（launcher + app.js）
 * 作为 srcdoc 注入到目标消息里的一个 <iframe>，等价于正则把卡片渲染进消息。
 * 这样 app 回到它原本的"每条消息独立 iframe"环境：
 *   - findMyImages 的 document 只含本条消息内容 -> 不会抓到别的图
 *   - launcher 卡片 DOM 存在 -> 状态栏等功能系统正常初始化
 *   - 末条消息会按原逻辑自动打开阅读器
 *
 * 产物:
 *   - extension/index.js  : window.__VNM_APP_HTML__ 模板 + 引导(入口注入与 iframe 注入)
 *   - extension/style.css : launcher.css（备用）
 *   - manifest.json (根)
 */
const fs = require('fs');
const path = require('path');
const { assembleReplaceString } = require('./build.js');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(__dirname, '..', 'src');
const EXT = path.join(ROOT, 'extension');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

// 组装出与正则完全一致的 HTML（去掉 ``` 围栏），并把内嵌源占位 $1 换成 token
let body = assembleReplaceString();
body = body.replace(/^```\n/, '').replace(/\n```\n?$/, '');
const meta = JSON.parse(fs.readFileSync(path.join(SRC, '_assembly.json'), 'utf8'));
const embTag = meta.embedded_source_tag;                 // <script ...>$1</script>
const embToken = embTag.replace('$1', '%%VNM_SOURCE%%'); // 占位
if (body.indexOf(embTag) === -1) throw new Error('build-extension: 未找到内嵌源标签锚点');
body = body.replace(embTag, embToken);

const bootstrap = fs.readFileSync(path.join(EXT, '_bootstrap.js'), 'utf8');
// 读取要默认预装到天气app的特效文件
const WFX_DIR = path.join(SRC, 'weather-effects');
let weatherFx = [];
if (fs.existsSync(WFX_DIR)) {
  weatherFx = fs.readdirSync(WFX_DIR).filter(function (f) { return /\.json$/i.test(f); }).map(function (f) {
    var o = JSON.parse(fs.readFileSync(path.join(WFX_DIR, f), 'utf8'));
    o._builtinId = f.replace(/\.json$/i, '');
    return o;
  }).filter(function (e) { return e && e.code; });
}
// 读取要默认预装的 VNM 插件 app（app/src/apps/*.json）
const APPS_DIR = path.join(SRC, 'apps');
let apps = [];
if (fs.existsSync(APPS_DIR)) {
  apps = fs.readdirSync(APPS_DIR).filter(function (f) { return /\.json$/i.test(f); }).map(function (f) {
    return JSON.parse(fs.readFileSync(path.join(APPS_DIR, f), 'utf8'));
  }).filter(function (a) { return a && a.vnmPlugin && a.id && a.name; });
}
const header =
  '/* Visual Novel by白桃 — SillyTavern 扩展(iframe 注入式) v' + pkg.version + '\n' +
  ' * 自动生成: app/scripts/build-extension.js (勿手改; 源在 app/src/* 与 extension/_bootstrap.js)\n' +
  ' */\n';

fs.mkdirSync(EXT, { recursive: true });
const indexJs = header +
  ';window.__VNM_VERSION__ = ' + JSON.stringify(pkg.version) + ';\n' +
  ';window.__VNM_APP_HTML__ = ' + JSON.stringify(body) + ';\n' +
  ';window.__VNM_APPS__ = ' + JSON.stringify(apps) + ';\n' +
  ';window.__VNM_WEATHER_FX__ = ' + JSON.stringify(weatherFx) + ';\n' +
  bootstrap;
fs.writeFileSync(path.join(EXT, 'index.js'), indexJs);
fs.writeFileSync(path.join(EXT, 'style.css'), fs.readFileSync(path.join(SRC, 'launcher.css'), 'utf8'));

const manifest = {
  display_name: 'Visual Novel by白桃',
  loading_order: 100,
  requires: [], optional: [],
  js: 'extension/index.js',
  css: 'extension/style.css',
  author: 'LAWLEITLIGHT',
  version: pkg.version,
  homePage: 'https://github.com/LAWLEITLIGHT/VisualNoval',
  auto_update: true,
};
fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('[build-extension] 预装天气特效:', weatherFx.map(function(e){return e.name;}).join(',') || '(无)');
console.log('[build-extension] 预装 app:', apps.map(function(a){return a.name;}).join(',') || '(无)');
console.log('[build-extension] index.js', indexJs.length, 'chars; APP_HTML', body.length, 'chars; v' + pkg.version);
