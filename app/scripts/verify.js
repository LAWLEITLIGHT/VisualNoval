/**
 * verify.js — 校验拼回的 replaceString 与原始正则 JSON 完全一致（round-trip）。
 * 需要把原始 vn_visual_novel-by白桃.json 放在 app/fixtures/original.json。
 */
const fs = require('fs');
const path = require('path');
const { assembleReplaceString } = require('./build.js');

const fixture = path.join(__dirname, '..', 'fixtures', 'original.json');
if (!fs.existsSync(fixture)) {
  console.log('[verify] 跳过: 未找到 app/fixtures/original.json (仅发布产物时需要)');
  process.exit(0);
}
const orig = JSON.parse(fs.readFileSync(fixture, 'utf8')).replaceString;
const built = assembleReplaceString();
if (orig === built) {
  console.log('[verify] OK — 拼回的 replaceString 与原版字节一致 (' + built.length + ' chars)');
  process.exit(0);
}
// diff report
let i = 0;
while (i < Math.min(orig.length, built.length) && orig[i] === built[i]) i++;
console.error('[verify] 失败 — 长度 orig=' + orig.length + ' built=' + built.length + ' 首个差异@' + i);
console.error('orig:', JSON.stringify(orig.slice(i, i + 60)));
console.error('built:', JSON.stringify(built.slice(i, i + 60)));
process.exit(1);
