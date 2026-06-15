/**
 * build.js — 把 app/src 下的模块化源码重新拼回酒馆正则的 replaceString，
 * 并产出可导入的正则 JSON 与 dist bundle。
 * 用法: node app/scripts/build.js
 * 目标: 拼回结果与原版 replaceString 完全字节一致（round-trip 安全）。
 */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

function assembleReplaceString() {
  const meta = JSON.parse(read('_assembly.json'));
  const css = read('launcher.css');
  const launcherHtml = read('launcher.html');
  const appjs = read('app.js');
  return (
    meta.fence_prefix + meta.seg0 + meta.embedded_source_tag +
    meta.between_src_and_style +
    meta.style_open + css + meta.style_close + launcherHtml +
    meta.script_open + appjs + meta.script_close +
    meta.tail_raw + meta.fence_suffix
  );
}
function buildRegexJson() {
  const regexMeta = JSON.parse(read('_regex-meta.json'));
  regexMeta.replaceString = assembleReplaceString();
  return regexMeta;
}
function main() {
  fs.mkdirSync(DIST, { recursive: true });
  const regexJson = buildRegexJson();
  const outPath = path.join(DIST, 'vn_visual_novel_liquidglass.json');
  fs.writeFileSync(outPath, JSON.stringify(regexJson));
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const manifest = {
    name: regexJson.scriptName, version: pkg.version,
    regexFile: 'app/dist/vn_visual_novel_liquidglass.json',
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('[build] regex JSON ->', outPath, '(' + regexJson.replaceString.length + ' chars)');
  console.log('[build] manifest v' + pkg.version);
}
if (require.main === module) main();
module.exports = { assembleReplaceString, buildRegexJson };
