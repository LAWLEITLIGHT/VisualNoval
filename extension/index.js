/* Visual Novel (liquid glass) — SillyTavern 扩展打包产物 v1.0.4
 * 自动生成: app/scripts/build-extension.js  (勿手改; 改源在 app/src/app.js 与 extension/_bootstrap.js)
 */
;try {(function(){
try { window.__VNM_openViewer = openViewer; window.__VNM_app_ready = true; } catch(__pre){ console.warn("[VNM-Ext] 提前暴露失败", __pre); }


console.log('[VNM v9.17] loaded');
const TOP = window.parent;
const TOPDOC = TOP.document;

function getRawSource(){
  try { if (typeof window.__VNM_SOURCE__ === 'string' && window.__VNM_SOURCE__) return window.__VNM_SOURCE__; } catch(e){}
  const el = document.getElementById('vnm-embedded-source');
  return el ? (el.textContent || '') : '';
}

function getMyMesElement(){
  const fe = window.frameElement;
  if (fe){
    const m = fe.closest('.mes');
    if (m) return m;
  }
  const fe2 = window.frameElement;
  if (!fe2 || !fe2.id) return null;
  const mm = fe2.id.match(/message-+(\d+)/i);
  if (!mm) return null;
  const idx = parseInt(mm[1], 10);
  let el = TOPDOC.querySelector('.mes[mesid="'+idx+'"]');
  if (el) return el;
  const all = TOPDOC.querySelectorAll('#chat .mes');
  return idx < all.length ? all[idx] : null;
}

// Inject <image> tag text into parent .mes_text so st-chatu8 can find it
function injectImagePlaceholders(){
  const raw = getRawSource();
  if (!raw) return;
  const mes = getMyMesElement();
  if (!mes || mes.querySelector('.vnm-img-ph')) return;
  const mesText = mes.querySelector('.mes_text');
  if (!mesText) return;
  const parts = [];
  let m;
  const re1 = /<image[^>]*>[\s\S]*?<\/image>/gi;
  while ((m = re1.exec(raw)) !== null) parts.push(m[0]);
  const re2 = /image###[\s\S]*?###/g;
  while ((m = re2.exec(raw)) !== null) parts.push(m[0]);
  if (!parts.length) return;
  const ph = TOPDOC.createElement('div');
  ph.className = 'vnm-img-ph';
  ph.setAttribute('data-vnm-placeholder','1');
  ph.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;font-size:0';
  ph.textContent = parts.join('\n');
  mesText.appendChild(ph);
  console.log('[VNM v8.0] injected', parts.length, 'image placeholder(s)');
  try { mesText.dispatchEvent(new TOP.Event('DOMSubtreeModified',{bubbles:true})); } catch(e){}
}

// Returns flat array of individual <img> elements (one per story image)
function findMyImages(){
  const imgs = [];
  const seen = new Set();
  function add(img){
    if (!seen.has(img)){ seen.add(img); imgs.push(img); }
  }
  // Roots to search: iframe doc + parent .mes element
  const roots = [document];
  const mes = getMyMesElement();
  if (mes) roots.push(mes);

  // Priority 1: img elements with st-chatu8 class
  roots.forEach(r => {
    if (!r) return;
    try { r.querySelectorAll('img.st-chatu8-image-tag-image').forEach(add); } catch(e){}
  });
  // Priority 2: img elements inside st-chatu8 containers
  if (!imgs.length) {
    roots.forEach(r => {
      if (!r) return;
      try { r.querySelectorAll('[class*="st-chatu8"] img, [class*="chatu8"] img').forEach(add); } catch(e){}
    });
  }
  // Priority 3: any blob img
  if (!imgs.length) {
    roots.forEach(r => {
      if (!r) return;
      try { r.querySelectorAll('img[src^="blob:"], img[src^="data:image"]').forEach(add); } catch(e){}
    });
  }

  console.log('[VNM v8.0] findMyImages:', imgs.length, 'image(s)');
  imgs.forEach(function(img,i){
    console.log('[VNM v8.0]  img['+i+'] src=', (img.src||'').substring(0,80), 'class=', img.className);
  });
  return imgs;
}

function parseRawSource(raw){
  // Strip multiple content block separators (if AI emits >1 <content> block)
  let cleaned = raw.replace(/<\/content>\s*<content[^>]*>/gi, '\n\n');
  cleaned = cleaned.replace(/<image[^>]*>[\s\S]*?<\/image>/gi, ' \x00IMG\x00 ');
  cleaned = cleaned.replace(/<imgthink[^>]*>[\s\S]*?<\/imgthink>/gi, '');
  cleaned = cleaned.replace(/image###[\s\S]*?###/g, '');
  cleaned = cleaned.replace(/【[^】\n]{0,100}】/g, '');
  // Strip HTML blocks injected by other regexes (嘎巴极简功能系统_KEEP_ etc.)
  // Remove <style> and <script> blocks entirely
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Iteratively peel innermost HTML elements (handles nesting)
  let _prev;
  do { _prev = cleaned; cleaned = cleaned.replace(/<[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?>[^<]*<\/[a-zA-Z][a-zA-Z0-9]*>/g, ''); } while (cleaned !== _prev);
  cleaned = cleaned.replace(/<[^>]+>/g, ''); // strip lone tags
  const sentences = [];
  let imageCount = 0;
  const lines = cleaned.split(/\n+/);
  for (const line of lines){
    const subs = line.split('\x00IMG\x00');
    for (let i = 0; i < subs.length; i++){
      const t = subs[i].replace(/\s+/g, ' ').trim();
      if (t) sentences.push({text: t, imgIdx: imageCount});
      if (i < subs.length - 1) imageCount++;
    }
  }
  return {sentences, imageCount};
}

// Get URL from an <img> element or container
function imgUrl(el){
  if (!el) return null;
  if (el.tagName === 'IMG') return el.currentSrc || el.src || el.getAttribute('data-src') || null;
  if (el.tagName === 'VIDEO') return el.src || null;
  const img = el.querySelector && el.querySelector('img[src]');
  if (img) return img.currentSrc || img.src || null;
  const bg = el.style && el.style.backgroundImage;
  if (bg && bg !== 'none'){
    const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
    if (m) return m[1];
  }
  const a = el.querySelector && el.querySelector('a[href^="blob:"]');
  if (a) return a.href;
  return null;
}

// Find the Nth st-chatu8 regen button (image-tag-button)
function findRegenButton(idx){
  const sel = 'button.image-tag-button, button[class*="image-tag-button"], button[class*="st-chatu8-image"]';
  const all = [];
  const seen = new Set();
  [document, getMyMesElement()].forEach(function(r){
    if (!r) return;
    try { r.querySelectorAll(sel).forEach(function(b){ if(!seen.has(b)){seen.add(b);all.push(b);} }); } catch(e){}
  });
  console.log('[VNM v8.0] regen buttons found:', all.length, 'targeting idx:', idx);
  return all[idx] || all[0] || null;
}

function openViewer(mode){
  mode = mode||'fullscreen';
  var _isInline=(mode==='pc'||mode==='mobile');
  var _doc=_isInline?document:TOPDOC;
  var _origFrameStyle=null;
  // iOS web-fullscreen state
  var _savedBodyStyle=null,_savedHtmlStyle=null,_savedScrollY=0,_vvHandler=null;
  console.log('[VNM v8.0] opening viewer mode='+mode);
  const raw = getRawSource();
  if (!raw){ alert('VN v6.0: 内嵌源为空'); return; }
  const parsed = parseRawSource(raw);
  const myImgs = findMyImages();
  console.log('[VNM v8.0] sentences:', parsed.sentences.length, 'imageCount:', parsed.imageCount, 'imgs:', myImgs.length);
  if (!parsed.sentences.length){ alert('VN: 解析不出句子'); return; }

  const oldOv = _doc.getElementById('vnm-overlay'); if (oldOv) oldOv.remove();

  if (!_doc.getElementById('vnm-overlay-style')){
    const st = _doc.createElement('style');
    st.id = 'vnm-overlay-style';
    st.textContent = '#vnm-overlay{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;height:100dvh;z-index:2147483600;background:#000;overflow:hidden;overscroll-behavior:none;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif;color:#fff;}#vnm-overlay.vnm-fading{opacity:0;transition:opacity .25s;}#vnm-bg{position:absolute;inset:0;background-position:center;background-size:cover;background-repeat:no-repeat;transition:opacity .3s ease;filter:brightness(.88);}#vnm-bg-blur{position:absolute;inset:0;background-position:center;background-size:cover;background-repeat:no-repeat;transition:opacity .3s ease;filter:blur(40px) brightness(.55) saturate(1.3);transform:scale(1.12);opacity:0;pointer-events:none;}#vnm-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.6) 0%,rgba(0,0,0,.1) 50%,rgba(0,0,0,0) 80%);pointer-events:none;}#vnm-click-layer{position:absolute;inset:0;cursor:pointer;z-index:1;}.vnm-ctrl-bar{position:absolute;top:-50px;right:0;display:flex;gap:6px;z-index:5;padding:6px;background:rgba(20,20,22,.12);border:1px solid rgba(255,255,255,.10);-webkit-backdrop-filter:blur(48px) saturate(220%);backdrop-filter:blur(48px) saturate(220%);border-radius:18px;box-shadow:0 4px 24px rgba(0,0,0,.20);}@keyframes vnm-regen-spin{to{transform:rotate(360deg);}}.vnm-icon-btn.vnm-loading{animation:vnm-regen-spin 0.85s linear infinite;opacity:0.6;pointer-events:none;}.vnm-icon-btn{width:36px;height:36px;border:1px solid transparent;cursor:pointer;background:transparent;color:rgba(255,255,255,.52);font-size:15px;border-radius:13px;display:inline-flex;align-items:center;justify-content:center;transition:all .18s;outline:none;}.vnm-icon-btn:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.96);}.vnm-corner-btn:hover{background:rgba(255,255,255,.15)!important;}.vnm-icon-btn.vnm-wide{width:auto;padding:0 12px;font-size:13px;}.vnm-dialog{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:min(880px,calc(100vw - 32px));background:rgba(20,20,22,.62);border:1px solid rgba(255,255,255,.14);-webkit-backdrop-filter:blur(32px) saturate(180%);backdrop-filter:blur(32px) saturate(180%);border-radius:22px;box-shadow:0 12px 48px rgba(0,0,0,.5);padding:22px 26px 18px;z-index:4;overflow:visible;transition:opacity .3s,transform .3s;}.vnm-dialog.vnm-hidden{opacity:0;transform:translateX(-50%) translateY(20px);pointer-events:none;}.vnm-text{font-size:18px;line-height:1.7;letter-spacing:.5px;min-height:60px;color:#f4f4f6;text-shadow:0 1px 2px rgba(0,0,0,.6);margin-bottom:14px;white-space:pre-wrap;word-break:break-word;}.vnm-progress{font-size:11px;color:rgba(255,255,255,.55);margin-bottom:10px;letter-spacing:1px;}.vnm-controls{display:flex;align-items:center;gap:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px;}.vnm-input{flex:1;min-width:0;padding:8px 14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:14px;color:#fff;font-size:14px;outline:none;font-family:inherit;}.vnm-input:focus{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3);}.vnm-input::placeholder{color:rgba(255,255,255,.4);}.vnm-tip{font-size:11px;color:rgba(255,255,255,.4);padding:0 2px;white-space:nowrap;}@keyframes vnm-spin{to{transform:rotate(360deg);}}.vnm-spinner{display:inline-block;width:10px;height:10px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:vnm-spin 0.8s linear infinite;margin-right:6px;vertical-align:middle;}#vnm-sb-tab::-webkit-scrollbar{width:3px;}#vnm-sb-tab::-webkit-scrollbar-track{background:transparent;}#vnm-sb-tab::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.14);border-radius:10px;}#vnm-sb-tab::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.25);}.vnm-icon-btn:active{transform:scale(0.88);opacity:.75;}';
    _doc.head.appendChild(st);
  }

  const overlay = _doc.createElement('div');
  overlay.id = 'vnm-overlay';
  overlay.innerHTML = '<div id="vnm-bg-blur"></div><div id="vnm-bg"></div><div id="vnm-click-layer"></div>'
    +'<div class="vnm-dialog" id="vnm-dialog">'
    +'<div class="vnm-ctrl-bar" id="vnm-ctrl-bar">'
    +'<div id="vnm-bar-btns" style="display:none;gap:6px;align-items:center;">'
    +'<button class="vnm-icon-btn" id="vnm-btn-sb-toggle" title="功能系统" data-act="sb-toggle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></button>'
    +'<button class="vnm-icon-btn" id="vnm-btn-prev" data-act="prev" title="上一段"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="15 18 9 12 15 6"/></svg></button>'
    +'<button class="vnm-icon-btn" id="vnm-btn-next" data-act="next" title="下一段"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="9 18 15 12 9 6"/></svg></button>'
    +'<button class="vnm-icon-btn" id="vnm-btn-regen" data-act="regen" title="重新生成背景图"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>'
    +'<button class="vnm-icon-btn" id="vnm-btn-save" data-act="save" title="保存背景图"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>'
    +'<button class="vnm-icon-btn" id="vnm-btn-settings" data-act="settings" title="设置"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:block"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></svg></button>'
    +'<button class="vnm-icon-btn" id="vnm-btn-hide" data-act="hide" title="隐藏/显示对话框"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>'
    +'<button class="vnm-icon-btn" id="vnm-btn-sync" data-act="sync" title="确认图片生成"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></button>'
    +'<button class="vnm-icon-btn" id="vnm-btn-prev-turn" data-act="prev-turn" title="上一轮"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none"/><line x1="5" y1="19" x2="5" y2="5"/></svg></button>'
    +'<button class="vnm-icon-btn" id="vnm-btn-next-turn" data-act="next-turn" title="下一轮"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none"/><line x1="19" y1="5" x2="19" y2="19"/></svg></button>'
    +'</div>'
    +'<div id=\"vnm-settings\" style=\"display:none;position:absolute;right:0;bottom:calc(100% + 10px);min-width:232px;background:rgba(16,16,20,.92);border:1px solid rgba(255,255,255,.14);-webkit-backdrop-filter:blur(40px) saturate(180%);backdrop-filter:blur(40px) saturate(180%);border-radius:18px;padding:16px 18px 14px;box-shadow:0 10px 40px rgba(0,0,0,.6);z-index:30;\"><button data-set=\"close\" style=\"position:absolute;top:10px;right:10px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:none;color:rgba(255,255,255,.45);font-size:14px;cursor:pointer;border-radius:8px;padding:0;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><div style=\"font-size:11px;color:rgba(255,255,255,.35);letter-spacing:1.8px;text-transform:uppercase;margin-bottom:14px;padding-right:20px;\">\u663e\u793a\u8bbe\u7f6e</div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);\">字体大小</span><select data-set=\"font-sel\" id=\"vnm-font-sel\" style=\"background:rgba(255,255,255,.09);border:0.5px solid rgba(255,255,255,.14);color:rgba(255,255,255,.88);border-radius:9px;padding:4px 8px;font-size:12px;outline:none;cursor:pointer;font-family:inherit;\"><option value=\"1\">1px</option><option value=\"2\">2px</option><option value=\"3\">3px</option><option value=\"4\">4px</option><option value=\"5\">5px</option><option value=\"6\">6px</option><option value=\"7\">7px</option><option value=\"8\">8px</option><option value=\"9\">9px</option><option value=\"10\">10px</option><option value=\"11\">11px</option><option value=\"12\">12px</option><option value=\"13\">13px</option><option value=\"14\">14px</option><option value=\"15\">15px</option><option value=\"16\">16px</option><option value=\"18\">18px</option><option value=\"20\">20px</option><option value=\"22\">22px</option><option value=\"24\">24px</option><option value=\"26\">26px</option><option value=\"28\">28px</option><option value=\"30\">30px</option></select></div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);\">对话框宽度</span><select data-set=\"width-sel\" id=\"vnm-width-sel\" style=\"background:rgba(255,255,255,.09);border:0.5px solid rgba(255,255,255,.14);color:rgba(255,255,255,.88);border-radius:9px;padding:4px 8px;font-size:12px;outline:none;cursor:pointer;font-family:inherit;\"><option value=\"null\">自动</option><option value=\"200\">200px</option><option value=\"280\">280px</option><option value=\"360\">360px</option><option value=\"440\">440px</option><option value=\"520\">520px</option><option value=\"600\">600px</option><option value=\"680\">680px</option><option value=\"760\">760px</option><option value=\"840\">840px</option><option value=\"920\">920px</option><option value=\"1000\">1000px</option><option value=\"1080\">1080px</option><option value=\"1160\">1160px</option><option value=\"1280\">1280px</option><option value=\"1400\">1400px</option><option value=\"1600\">1600px</option><option value=\"1920\">1920px</option></select></div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);\">对话框高度</span><select data-set=\"height-sel\" id=\"vnm-height-sel\" style=\"background:rgba(255,255,255,.09);border:0.5px solid rgba(255,255,255,.14);color:rgba(255,255,255,.88);border-radius:9px;padding:4px 8px;font-size:12px;outline:none;cursor:pointer;font-family:inherit;\"><option value=\"null\">自适应</option><option value=\"10\">10px</option><option value=\"15\">15px</option><option value=\"20\">20px</option><option value=\"25\">25px</option><option value=\"30\">30px</option><option value=\"40\">40px</option><option value=\"50\">50px</option><option value=\"60\">60px</option><option value=\"75\">75px</option><option value=\"90\">90px</option><option value=\"110\">110px</option><option value=\"130\">130px</option><option value=\"160\">160px</option><option value=\"200\">200px</option><option value=\"250\">250px</option><option value=\"300\">300px</option><option value=\"400\">400px</option><option value=\"500\">500px</option><option value=\"600\">600px</option></select></div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);\">毛玻璃浓度</span><select data-set=\"glass-sel\" id=\"vnm-glass-sel\" style=\"background:rgba(255,255,255,.09);border:0.5px solid rgba(255,255,255,.14);color:rgba(255,255,255,.88);border-radius:9px;padding:4px 8px;font-size:12px;outline:none;cursor:pointer;font-family:inherit;\"><option value=\"0.00\">0% (无)</option><option value=\"0.05\">5%</option><option value=\"0.10\">10%</option><option value=\"0.15\">15%</option><option value=\"0.20\">20%</option><option value=\"0.28\">28%</option><option value=\"0.35\">35%</option><option value=\"0.42\">42%</option><option value=\"0.50\">50%</option><option value=\"0.55\">55%</option><option value=\"0.62\">62%</option><option value=\"0.68\">68%</option><option value=\"0.74\">74%</option><option value=\"0.80\">80%</option><option value=\"0.88\">88%</option><option value=\"0.92\">92%</option><option value=\"0.96\">96%</option><option value=\"1.00\">100%</option></select></div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);\">检测图像数量</span><select data-set=\"imgcount-sel\" id=\"vnm-imgcount-sel\" style=\"background:rgba(255,255,255,.09);border:0.5px solid rgba(255,255,255,.14);color:rgba(255,255,255,.88);border-radius:9px;padding:4px 8px;font-size:12px;outline:none;cursor:pointer;font-family:inherit;\"><option value=\"auto\">自动</option><option value=\"1\">1张</option><option value=\"2\">2张</option><option value=\"3\">3张</option><option value=\"4\">4张</option><option value=\"5\">5张</option><option value=\"6\">6张</option><option value=\"7\">7张</option><option value=\"8\">8张</option><option value=\"9\">9张</option><option value=\"10\">10张</option><option value=\"11\">11张</option><option value=\"12\">12张</option><option value=\"13\">13张</option><option value=\"14\">14张</option><option value=\"15\">15张</option><option value=\"16\">16张</option><option value=\"17\">17张</option><option value=\"18\">18张</option><option value=\"19\">19张</option><option value=\"20\">20张</option></select></div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);\">输入框高度</span><select data-set=\"input-scale-sel\" id=\"vnm-input-scale-sel\" style=\"background:rgba(255,255,255,.09);border:0.5px solid rgba(255,255,255,.14);color:rgba(255,255,255,.88);border-radius:9px;padding:4px 8px;font-size:12px;outline:none;cursor:pointer;font-family:inherit;\"><option value=\"20\">20%</option><option value=\"40\">40%</option><option value=\"60\">60%</option><option value=\"80\">80%</option><option value=\"100\">100%</option><option value=\"120\">120%</option><option value=\"140\">140%</option><option value=\"160\">160%</option><option value=\"180\">180%</option><option value=\"200\">200%</option></select></div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);\">图像显示模式</span><select data-set=\"imgmode-sel\" id=\"vnm-imgmode-sel\" style=\"background:rgba(255,255,255,.09);border:0.5px solid rgba(255,255,255,.14);color:rgba(255,255,255,.88);border-radius:9px;padding:4px 8px;font-size:12px;outline:none;cursor:pointer;font-family:inherit;\"><option value=\"adaptive\">自适应</option><option value=\"contain\">完整</option></select></div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);\">功能栏大小</span><select data-set=\"toolbar-sel\" id=\"vnm-toolbar-sel\" style=\"background:rgba(255,255,255,.09);border:0.5px solid rgba(255,255,255,.14);color:rgba(255,255,255,.88);border-radius:9px;padding:4px 8px;font-size:12px;outline:none;cursor:pointer;font-family:inherit;\"><option value=\"10\">10%</option><option value=\"15\">15%</option><option value=\"20\">20%</option><option value=\"25\">25%</option><option value=\"30\">30%</option><option value=\"35\">35%</option><option value=\"40\">40%</option><option value=\"50\">50%</option><option value=\"60\">60%</option><option value=\"70\">70%</option><option value=\"75\">75%</option><option value=\"80\">80%</option><option value=\"85\">85%</option><option value=\"90\">90%</option><option value=\"95\">95%</option><option value=\"100\">100%</option><option value=\"110\">110%</option><option value=\"120\">120%</option><option value=\"130\">130%</option><option value=\"140\">140%</option><option value=\"150\">150%</option><option value=\"160\">160%</option><option value=\"175\">175%</option><option value=\"200\">200%</option></select></div><div style=\"margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px;\"><div style=\"font-size:10px;color:rgba(255,255,255,.32);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:7px;\">常驻按钮（亮=常驻，暗=收纳）</div><div style=\"display:flex;gap:5px;\"><button data-pin=\"prev\" title=\"上一段\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="15 18 9 12 15 6"/></svg></button><button data-pin=\"next\" title=\"下一段\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="9 18 15 12 9 6"/></svg></button><button data-pin=\"regen\" title=\"重画\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button><button data-pin=\"save\" title=\"保存\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button data-pin=\"settings\" title=\"设置\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:block"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></svg></button><button data-pin=\"hide\" title=\"隐藏\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button><button data-pin=\"sync\" title=\"确认图片\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></button><button data-pin=\"prev-turn\" title=\"上一轮\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none"/><line x1="5" y1="19" x2="5" y2="5"/></svg></button><button data-pin=\"next-turn\" title=\"下一轮\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none"/><line x1="19" y1="5" x2="19" y2="19"/></svg></button><button data-pin=\"sb-toggle\" title=\"功能系统\" style=\"width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"display:block\"><rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/><line x1=\"8\" y1=\"21\" x2=\"16\" y2=\"21\"/><line x1=\"12\" y1=\"17\" x2=\"12\" y2=\"21\"/></svg></button></div></div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);">发送不退出</span><button data-set=\"staymode\" id=\"vnm-staymode-btn\" style=\"padding:4px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.5);border-radius:10px;font-size:12px;cursor:pointer;font-family:inherit;transition:all .15s;\">关</button></div><div style=\"display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);margin-bottom:10px;\"><span style=\"font-size:13px;color:rgba(255,255,255,.7);\">自动重发生成请求</span><button data-set=\"autopvp\" id=\"vnm-autopvp-btn\" style=\"padding:4px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.5);border-radius:10px;font-size:12px;cursor:pointer;font-family:inherit;transition:all .15s;\">关</button></div><button data-set=\"reset\" style=\"display:block;width:100%;margin-top:4px;padding:7px 0;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);border-radius:10px;font-size:12px;cursor:pointer;font-family:inherit;letter-spacing:.5px;\">&#8635; \u6062\u590d\u9ed8\u8ba4</button></div>'
    +'<div id="vnm-bar-pinned" style="display:flex;gap:6px;align-items:center;"></div>'
    +'<button class="vnm-icon-btn" data-act="toggle-bar" title="收纳/展开按钮"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:block"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>'
    +'<button class="vnm-icon-btn" data-act="close" title="退出"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
    +'</div>'
    +'<div class="vnm-progress" id="vnm-progress"></div>'
    +'<div class="vnm-text" id="vnm-text"></div>'
    +'<div class="vnm-controls"><div id="vnm-send-status" style="display:none;flex:1;align-items:center;gap:8px;padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;font-size:13px;color:rgba(255,255,255,.55);letter-spacing:.3px;"><span class="vnm-spinner"></span><span id="vnm-send-status-text">已发送，等待 AI 回复…</span></div><input class="vnm-input" id="vnm-input" type="text" placeholder="输入文字按 Enter 发送给酒馆…" /><span class="vnm-tip">Enter=发送  Esc=退出</span></div>'
    +'</div>';
  _doc.body.appendChild(overlay);
  // Web mode: lock body scroll (iOS position:fixed trick) + height sync
  if(mode==='web'){
    try{
      _savedScrollY=TOP.scrollY||0;
      _savedBodyStyle={
        overflow:TOPDOC.body.style.overflow,
        position:TOPDOC.body.style.position,
        width:TOPDOC.body.style.width,
        top:TOPDOC.body.style.top
      };
      _savedHtmlStyle=TOPDOC.documentElement.style.overflow;
      TOPDOC.body.style.overflow='hidden';
      TOPDOC.body.style.position='fixed';
      TOPDOC.body.style.width='100%';
      TOPDOC.body.style.top='-'+_savedScrollY+'px';
      TOPDOC.documentElement.style.overflow='hidden';
    }catch(e){}
    // iOS Safari: visualViewport fires when soft keyboard / chrome resizes.
    // We ONLY update height — position is left to CSS position:fixed
    // (do NOT set top/left via JS: position:fixed already tracks visual
    //  viewport on iOS, manually adding offsetTop double-shifts the overlay
    //  and breaks tap targets)
    if(TOP.visualViewport){
      /* 软键盘弹出时让对话框跑到输入法上方（对齐"全屏"模式的表现）：
         1. height 跟随 visualViewport.height（键盘占掉的高度被裁掉）
         2. top 跟随 visualViewport.offsetTop（浏览器为露出输入框平移视口时补偿）
         3. 同时监听 resize 与 scroll（Android/iOS 键盘动画期间两者都会触发） */
      _vvHandler=function(){
        try{
          var vv=TOP.visualViewport;
          overlay.style.setProperty('height',vv.height+'px','important');
          overlay.style.setProperty('top',(vv.offsetTop||0)+'px','important');
          overlay.style.setProperty('bottom','auto','important');
        }catch(e){}
      };
      TOP.visualViewport.addEventListener('resize',_vvHandler);
      TOP.visualViewport.addEventListener('scroll',_vvHandler);
      _vvHandler();
      /* 兜底：部分安卓浏览器键盘动画结束后才稳定，聚焦/失焦后延迟再同步一次 */
      var _vvKick=function(){TOP.setTimeout(_vvHandler,120);TOP.setTimeout(_vvHandler,400);};
      overlay.addEventListener('focusin',_vvKick);
      overlay.addEventListener('focusout',_vvKick);
    }
  }
  if(_isInline){
    try{
      var _fe=window.frameElement;
      if(_fe){
        _origFrameStyle=_fe.getAttribute('style')||'';
        var _fw=mode==='pc'?'100%':'100%';
        var _fh=mode==='pc'?'540px':'680px';
        var _fmx=mode==='pc'?'900px':'480px';
        var _fbr=mode==='pc'?'16px':'20px';
        function _applyFe(){
          if(!_fe) return;
          _fe.style.setProperty('width',_fw,'important');
          _fe.style.setProperty('max-width',_fmx,'important');
          _fe.style.setProperty('height',_fh,'important');
          _fe.style.setProperty('min-height',_fh,'important');
          _fe.style.setProperty('border','none','important');
          _fe.style.setProperty('border-radius',_fbr,'important');
          _fe.style.setProperty('overflow','hidden','important');
          _fe.style.setProperty('display','block','important');
          _fe.setAttribute('height',parseInt(_fh));
        }
        _applyFe();
        TOP.setTimeout(_applyFe,80);
        TOP.setTimeout(_applyFe,400);
      }
    }catch(e){}
  }

  // 功能系统 HTML 内的按钮可通过 window.parent._vnmInject(text) 调用此桥接函数
  // text 会被拼到 VNM 输入框内容前，用户按 Enter 时一同发送
  TOP._vnmInject = function(text){
    var inp = overlay.querySelector('#vnm-input');
    if(!inp) return;
    var cur = inp.value;
    inp.value = text + (cur ? '\n' + cur : '');
    inp.focus();
  };
  // Allow external close (for 'close all' broadcast)
  window._vnmClose = function(){ close(); };

  var _stKey='vnm-settings-v6-'+mode;
  var _saved=(function(){try{return JSON.parse(TOP.localStorage.getItem(_stKey)||'{}')}catch(e){return{}}})();
  const state = {idx:0, hidden:false, sentences:parsed.sentences, myImgs:myImgs,
    pollTimer:null, pollCount:0, imageCount:parsed.imageCount, regenPending:false, regenTimer:null,
    settingsOpen:false, ctrlCollapsed:true,
    fontSize: 'fontSize' in _saved?_saved.fontSize:(_isInline?15:18),
    dialogWidth: 'dialogWidth' in _saved ? _saved.dialogWidth : null,
    dialogHeight: 'dialogHeight' in _saved ? _saved.dialogHeight : null,
    glassOpacity: _saved.glassOpacity!==undefined?_saved.glassOpacity:0.62,
    toolbarScale: 'toolbarScale' in _saved?_saved.toolbarScale:(_isInline?60:100), imgMode: _saved.imgMode||'adaptive',
    inputScale: 'inputScale' in _saved?_saved.inputScale:(_isInline?60:100),
    pinnedBtns: _saved.pinnedBtns||[],
    stayMode: 'stayMode' in _saved ? _saved.stayMode : false,
    autoPvp: 'autoPvp' in _saved ? _saved.autoPvp : false, pvpQueue: [], pvpBusy: false, pvpTimer: null,
    imageCountOverride: 'imageCountOverride' in _saved ? _saved.imageCountOverride : null,
    sentPending: false, watchTimer: null
  };
  const bg = overlay.querySelector('#vnm-bg');
  const textEl = overlay.querySelector('#vnm-text');
  const progEl = overlay.querySelector('#vnm-progress');
  const dialog = overlay.querySelector('#vnm-dialog');
  const ctrlBar = overlay.querySelector('#vnm-ctrl-bar');
  const regenBtn = overlay.querySelector('#vnm-btn-regen');
  const input = overlay.querySelector('#vnm-input');

  // ── Settings ─────────────────────────────────────────
  const FONT_SIZES    = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,20,22,24,26,28,30];
  const DIALOG_WIDTHS  = [null,200,280,360,440,520,600,680,760,840,920,1000,1080,1160,1280,1400,1600,1920];
  const DIALOG_HEIGHTS = [null,10,15,20,25,30,40,50,60,75,90,110,130,160,200,250,300,400,500,600];
  const GLASS_OPACITIES = [0.00,0.05,0.10,0.15,0.20,0.28,0.35,0.42,0.50,0.55,0.62,0.68,0.74,0.80,0.88,0.92,0.96,1.00];
  const TOOLBAR_SCALES  = [10,15,20,25,30,35,40,50,60,70,75,80,85,90,95,100,110,120,130,140,150,160,175,200];
  const INPUT_SCALES    = [20,40,60,80,100,120,140,160,180,200];

  function applySettings(){
    textEl.style.fontSize = state.fontSize + 'px';
    textEl.style.lineHeight = state.fontSize<=8?'2.0':state.fontSize<=11?'1.9':state.fontSize<=15?'1.85':state.fontSize<=18?'1.7':'1.6';
    if (state.dialogWidth===null){ dialog.style.width=''; } else {
      var vw=TOP.innerWidth; var wi=DIALOG_WIDTHS.indexOf(state.dialogWidth);
      var fracs=[0.70,0.82,0.93,1.0,1.0]; var frac=wi>=1?fracs[wi-1]:0.93;
      var w=state.dialogWidth>vw-20?Math.round(vw*frac):state.dialogWidth;
      dialog.style.width=Math.max(260,Math.min(w,vw-8))+'px';
    }
    textEl.style.minHeight = state.dialogHeight===null ? '0' : state.dialogHeight+'px';
    var ga=state.glassOpacity;
    dialog.style.background='rgba(20,20,22,'+ga+')';
    var _cb=overlay.querySelector('#vnm-ctrl-bar');
    if(_cb) _cb.style.background='rgba(20,20,22,'+Math.max(0,ga-0.07)+')';
    saveSettingsToStorage();
    refreshPins();
    // Sync select dropdowns
    var _fsel=overlay.querySelector('#vnm-font-sel'); if(_fsel) _fsel.value=String(state.fontSize);
    var _wsel=overlay.querySelector('#vnm-width-sel'); if(_wsel) _wsel.value=state.dialogWidth===null?'null':String(state.dialogWidth);
    var _hsel=overlay.querySelector('#vnm-height-sel'); if(_hsel) _hsel.value=state.dialogHeight===null?'null':String(state.dialogHeight);
    var _gsel=overlay.querySelector('#vnm-glass-sel'); if(_gsel) _gsel.value=state.glassOpacity.toFixed(2);
    var _isel=overlay.querySelector('#vnm-imgcount-sel'); if(_isel) _isel.value=state.imageCountOverride===null?'auto':String(state.imageCountOverride);
    var _tsel=overlay.querySelector('#vnm-toolbar-sel'); if(_tsel) _tsel.value=String(state.toolbarScale||100);
    var _iscl=overlay.querySelector('#vnm-input-scale-sel'); if(_iscl) _iscl.value=String(state.inputScale||100); var _imsel=overlay.querySelector('#vnm-imgmode-sel'); if(_imsel) _imsel.value=state.imgMode||'adaptive'; applyImgMode();
    // Toolbar: right+bottom anchored, scale toward top-left
    if(ctrlBar){ctrlBar.style.transform='scale('+((state.toolbarScale||100)/100)+')';ctrlBar.style.transformOrigin='right bottom';}
    // Input area zoom
    var _ctrls=overlay.querySelector('.vnm-controls');
    if(_ctrls){_ctrls.style.zoom=String((state.inputScale||100)/100);}
  }
  function toggleSettings(){
    var panel=overlay.querySelector('#vnm-settings'); if(!panel) return;
    state.settingsOpen=!state.settingsOpen; panel.style.display=state.settingsOpen?'block':'none';
    if(state.settingsOpen){ applyStayModeUI(); applyAutoPvpUI(); }
  }
  function closeSettings(){
    state.settingsOpen=false; var panel=overlay.querySelector('#vnm-settings'); if(panel) panel.style.display='none';
  }
  function refreshPins(){
    var order=['prev','next','regen','sync','save','settings','hide','prev-turn','next-turn','sb-toggle'];
    var pinned=overlay.querySelector('#vnm-bar-pinned');
    var collapsible=overlay.querySelector('#vnm-bar-btns');
    if(!pinned||!collapsible) return;
    var sp=overlay.querySelector('#vnm-settings');
    order.forEach(function(id){
      var btn=overlay.querySelector('#vnm-btn-'+id); if(!btn) return;
      if(state.pinnedBtns.indexOf(id)>=0) pinned.appendChild(btn);
      else collapsible.appendChild(btn);
    });
    if(sp) ctrlBar.appendChild(sp);
    // Update pin toggle button highlights
    var pbtns=overlay.querySelectorAll('[data-pin]');
    pbtns.forEach(function(b){
      var active=state.pinnedBtns.indexOf(b.dataset.pin)>=0;
      b.style.background=active?'rgba(255,255,255,.22)':'rgba(255,255,255,.07)';
      b.style.color=active?'rgba(255,255,255,.95)':'rgba(255,255,255,.5)';
      b.style.borderColor=active?'rgba(255,255,255,.35)':'rgba(255,255,255,.12)';
    });
  }

  // ── Image sync & auto-PVP ───────────────────────────────
  function syncImages(){
    state.myImgs = findMyImages();
    render();
    var total = state.imageCountOverride!==null ? state.imageCountOverride : state.imageCount;
    var have = state.myImgs.filter(function(el){return !!imgUrl(el);}).length;
    var missing = [];
    for(var i=0;i<total;i++){
      if(i>=state.myImgs.length||!imgUrl(state.myImgs[i])) missing.push(i);
    }
    if(!missing.length){
      showToast('图像 '+have+'/'+total+' 全部已生成 ✓');
      return;
    }
    showToast('检测到图像 '+have+'/'+total+'，正在重新请求 '+missing.length+' 张…', 3500);
    if(state.autoPvp){
      missing.forEach(function(si){ pvpEnqueue(si); });
    } else {
      missing.forEach(function(si,i){
        TOP.setTimeout(function(){
          var btn=findRegenButton(si); if(btn){ btn.click(); }
        }, i*2500);
      });
      if(!state.pollTimer) startPolling();
    }
  }
  function pvpEnqueue(si){
    if(state.pvpQueue.indexOf(si)<0) state.pvpQueue.push(si);
    if(!state.pvpBusy) pvpProcess();
  }
  function pvpProcess(){
    if(!state.autoPvp||!state.pvpQueue.length){state.pvpBusy=false;return;}
    state.pvpBusy=true;
    var si=state.pvpQueue[0];
    state.myImgs=findMyImages();
    if(si<state.myImgs.length&&imgUrl(state.myImgs[si])){
      state.pvpQueue.shift(); state.pvpBusy=false; pvpProcess(); return;
    }
    var btn=findRegenButton(si);
    if(btn){ btn.click(); console.log('[VNM] pvp: regen slot '+si); }
    state.pvpTimer=TOP.setTimeout(function(){
      state.myImgs=findMyImages(); render();
      if(si<state.myImgs.length&&imgUrl(state.myImgs[si])){
        console.log('[VNM] pvp: slot '+si+' done');
        state.pvpQueue.shift(); state.pvpBusy=false; pvpProcess();
      } else {
        console.log('[VNM] pvp: slot '+si+' still missing, retrying');
        state.pvpBusy=false; pvpProcess();
      }
    }, 15000);
  }
  function toggleAutoPvp(){
    state.autoPvp=!state.autoPvp;
    if(!state.autoPvp){
      state.pvpQueue=[]; state.pvpBusy=false;
      if(state.pvpTimer){TOP.clearTimeout(state.pvpTimer);state.pvpTimer=null;}
    }
    applyAutoPvpUI();
  }
  
  function getVnmMes(){
    var all=Array.from(TOPDOC.querySelectorAll('#chat .mes'));
    return all.filter(function(mes){
      var frs=mes.querySelectorAll('iframe');
      for(var i=0;i<frs.length;i++){
        try{ var doc=frs[i].contentDocument||frs[i].contentWindow.document;
          if(doc&&(doc.getElementById('vnm-card')||doc.getElementById('vnm-launch'))) return true; }catch(e){}
      } return false;
    });
  }
  function jumpToTurn(mes,startAtEnd){
    var frs=mes.querySelectorAll('iframe');
    for(var i=0;i<frs.length;i++){
      try{ var doc=frs[i].contentDocument||frs[i].contentWindow.document;
        var _jMode=null;try{_jMode=TOP.localStorage.getItem('vnm-display-mode');}catch(e){}
        var _jBtnId=(_jMode==='mobile')?'vnm-btn-mobile':(_jMode==='pc')?'vnm-btn-pc':(_jMode==='web')?'vnm-btn-web':'vnm-btn-full';
        var btn=doc&&(doc.getElementById(_jBtnId)||doc.getElementById('vnm-launch'));
        if(btn){ close(); var _sae=!!startAtEnd; TOP.setTimeout(function(){if(_sae)try{TOP._vnmStartAtEnd=true;}catch(e){}; btn.click();},300); return; }
      }catch(e){}
    }
  }
  function prevTurn(){
    var list=getVnmMes(); var cur=getMyMesElement(); var idx=list.indexOf(cur);
    if(idx>0) jumpToTurn(list[idx-1],true);
  }
  function nextTurn(){
    var list=getVnmMes(); var cur=getMyMesElement(); var idx=list.indexOf(cur);
    if(idx>=0&&idx<list.length-1) jumpToTurn(list[idx+1]);
  }
  function updateTurnCornerBtn(){
    var list=getVnmMes(); var cur=getMyMesElement(); var idx=list.indexOf(cur);
    var hasNext=idx>=0&&idx<list.length-1;
    var existing=overlay.querySelector('#vnm-dynamic-next');
    if(hasNext&&!existing){
      var nb=TOPDOC.createElement('button');
      nb.id='vnm-dynamic-next'; nb.className='vnm-icon-btn'; nb.title='跳到下一对话';
      nb.innerHTML='&#x21E8;';
      nb.style.cssText='background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22);color:rgba(255,255,255,.88);';
      var cb=overlay.querySelector('#vnm-ctrl-bar');
      var tb=cb&&cb.querySelector('[data-act="toggle-bar"]');
      if(tb) cb.insertBefore(nb,tb);
      nb.addEventListener('click',function(e){e.stopPropagation();nextTurn();});
    } else if(!hasNext&&existing){ existing.remove(); }
  }

  // ── Stay mode ───────────────────────────────────────────
  function saveSettingsToStorage(){
    try{TOP.localStorage.setItem(_stKey,JSON.stringify({fontSize:state.fontSize,dialogWidth:state.dialogWidth,dialogHeight:state.dialogHeight,glassOpacity:state.glassOpacity,toolbarScale:state.toolbarScale,inputScale:state.inputScale,pinnedBtns:state.pinnedBtns,stayMode:state.stayMode,autoPvp:state.autoPvp,imageCountOverride:state.imageCountOverride,imgMode:state.imgMode||'adaptive'}));}catch(e){}
  }
  function applyAutoPvpUI(){
    var ab=overlay.querySelector('#vnm-autopvp-btn');
    if(!ab) return;
    ab.textContent=state.autoPvp?'开':'关';
    ab.style.background=state.autoPvp?'rgba(255,255,255,.16)':'rgba(255,255,255,.07)';
    ab.style.borderColor=state.autoPvp?'rgba(255,255,255,.32)':'rgba(255,255,255,.14)';
    ab.style.color=state.autoPvp?'rgba(255,255,255,.95)':'rgba(255,255,255,.5)';
  }
  function applyStayModeUI(){
    var sb=overlay.querySelector('#vnm-staymode-btn');
    if(!sb) return;
    sb.textContent=state.stayMode?'开':'关';
    sb.style.background=state.stayMode?'rgba(255,255,255,.16)':'rgba(255,255,255,.07)';
    sb.style.borderColor=state.stayMode?'rgba(255,255,255,.32)':'rgba(255,255,255,.14)';
    sb.style.color=state.stayMode?'rgba(255,255,255,.95)':'rgba(255,255,255,.5)';
  }
  function showSentState(){
    state.sentPending=true;
    var st=overlay.querySelector('#vnm-send-status');
    var txt=overlay.querySelector('#vnm-send-status-text');
    var inp=overlay.querySelector('#vnm-input');
    if(st) st.style.display='flex';
    if(inp) inp.style.display='none';
    if(txt) txt.textContent='已发送，等待 AI 回复…';

    var mesCount=TOPDOC.querySelectorAll('#chat .mes').length;
    var phase=0; // 0=等待新消息  1=监控内容增长  2=完成
    var prevLen=-1;
    var stableCount=0;

    // 30s 内无新消息 → AI 无回应
    var noReplyTimer=TOP.setTimeout(function(){
      if(phase===0){
        if(txt) txt.textContent='未检测到 AI 回复';
        TOP.setTimeout(hideSentState,2500);
        if(state.watchTimer){TOP.clearInterval(state.watchTimer);state.watchTimer=null;}
      }
    },30000);

    if(state.watchTimer){TOP.clearInterval(state.watchTimer);state.watchTimer=null;}
    state.watchTimer=TOP.setInterval(function(){
      var curCount=TOPDOC.querySelectorAll('#chat .mes').length;

      // Phase 0→1: 检测到新 .mes 出现
      if(phase===0&&curCount>mesCount){
        phase=1;
        TOP.clearTimeout(noReplyTimer);
        if(txt) txt.textContent='AI 回复中…';
        prevLen=-1; stableCount=0;
      }

      // Phase 1: 监控 .last_mes 内容长度，连续2次不变即视为生成完毕
      if(phase===1){
        var lastMes=TOPDOC.querySelector('#chat .mes.last_mes');
        if(!lastMes||lastMes.getAttribute('is_user')==='true') return;
        var mesText=lastMes.querySelector('.mes_text');
        var curLen=mesText?mesText.textContent.length:0;
        if(prevLen>=0&&curLen===prevLen){
          stableCount++;
          if(stableCount>=2){
            phase=2;
            TOP.clearInterval(state.watchTimer);state.watchTimer=null;
            hideSentState();
            TOP.setTimeout(function(){
              updateTurnCornerBtn();
              var list=getVnmMes();var cur=getMyMesElement();var idx=list.indexOf(cur);
              if(idx>=0&&idx<list.length-1) showToast('新对话已就绪 →',2500);
            },600);
          }
        } else {
          stableCount=0;
        }
        prevLen=curLen;
      }
    },800);
  }
  function hideSentState(){
    state.sentPending=false;
    var st=overlay.querySelector('#vnm-send-status');
    var inp=overlay.querySelector('#vnm-input');
    if(st) st.style.display='none';
    if(inp) inp.style.display='';
  }
  function toggleCtrlBar(){
    state.ctrlCollapsed=!state.ctrlCollapsed;
    var btns=overlay.querySelector('#vnm-bar-btns');
    if(btns) btns.style.display=state.ctrlCollapsed?'none':'flex';
  }
  // Settings panel events
  setTimeout(function(){
    var sp=overlay.querySelector('#vnm-settings'); if(!sp) return;
    sp.addEventListener('click',function(e){
      e.stopPropagation();
      var btn=e.target.closest('[data-set]'); if(!btn) return;
      var type=btn.dataset.set; var dir=parseInt(btn.dataset.dir)||0;
      if(type==='close'){ closeSettings(); }
      else if(type==='reset'){ state.fontSize=(_isInline?15:18);state.dialogWidth=null;state.dialogHeight=null;state.glassOpacity=0.62;state.toolbarScale=(_isInline?60:100);state.inputScale=(_isInline?60:100);state.pinnedBtns=[]; applySettings(); }
      else if(type==='staymode'){ state.stayMode=!state.stayMode; applyStayModeUI(); saveSettingsToStorage(); }
      else if(type==='autopvp'){ state.autoPvp=!state.autoPvp; applyAutoPvpUI(); if(!state.autoPvp){state.pvpQueue=[];state.pvpBusy=false;if(state.pvpTimer){TOP.clearTimeout(state.pvpTimer);state.pvpTimer=null;}} saveSettingsToStorage(); }
          });
    // Pin toggle buttons
    sp.addEventListener('click',function(e){
      var btn=e.target.closest('[data-pin]'); if(!btn) return;
      e.stopPropagation();
      var id=btn.dataset.pin;
      var idx=state.pinnedBtns.indexOf(id);
      if(idx>=0) state.pinnedBtns.splice(idx,1); else state.pinnedBtns.push(id);
      applySettings();
    });
    // ── Dropdown change handler ──────────────────────────────────────
    sp.addEventListener('change',function(e){
      e.stopPropagation();
      var sel=e.target.closest('[data-set]'); if(!sel) return;
      var type=sel.dataset.set; var v=sel.value;
      if(type==='font-sel'){
        state.fontSize=parseInt(v)||18; applySettings();
      } else if(type==='width-sel'){
        state.dialogWidth=(v==='null')?null:parseInt(v); applySettings();
      } else if(type==='height-sel'){
        state.dialogHeight=(v==='null')?null:parseInt(v); applySettings();
      } else if(type==='glass-sel'){
        var _gvp=parseFloat(v);state.glassOpacity=isNaN(_gvp)?0.62:_gvp; applySettings();
      } else if(type==='imgcount-sel'){
        state.imageCountOverride=(v==='auto')?null:parseInt(v); saveSettingsToStorage();
      } else if(type==='toolbar-sel'){
        state.toolbarScale=parseInt(v)||100; applySettings();
      } else if(type==='input-scale-sel'){
        state.inputScale=parseInt(v)||100; applySettings();
      } else if(type==='imgmode-sel'){
        state.imgMode=v; applyImgMode(); saveSettingsToStorage();
      }
    });
  },0);
  // ─────────────────────────────────────────────────────

  // Get URL for current sentence: search forward first, then backward
  function urlForSentence(s){
    if (!state.myImgs.length) return null;
    const N = s.imgIdx;
    for (let i = N; i < state.myImgs.length; i++){
      const u = imgUrl(state.myImgs[i]); if (u) return u;
    }
    for (let i = N - 1; i >= 0; i--){
      const u = imgUrl(state.myImgs[i]); if (u) return u;
    }
    return null;
  }

  function showToast(msg,dur){
    dur=(dur===undefined)?2200:dur;
    var t=overlay.querySelector('#vnm-toast');
    if(t){TOP.clearTimeout(t._vtimer);t.remove();}
    t=TOPDOC.createElement('div'); t.id='vnm-toast';
    t.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% + 14px);'
      +'background:rgba(18,18,22,.84);border:1px solid rgba(255,255,255,.14);'
      +'-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);'
      +'border-radius:22px;padding:9px 22px;font-size:13px;color:rgba(255,255,255,.88);'
      +'white-space:nowrap;pointer-events:none;z-index:50;letter-spacing:.3px;'
      +'opacity:0;transition:opacity .2s ease;';
    t.textContent=msg;
    dialog.appendChild(t);
    TOP.setTimeout(function(){t.style.opacity='1';},16);
    if(dur>0){
      t._vtimer=TOP.setTimeout(function(){
        t.style.opacity='0';
        TOP.setTimeout(function(){if(t.parentNode)t.remove();},220);
      },dur);
    }
    return t;
  }
  function renderBg(url){
    var newVal = url ? 'url("'+url.replace(/"/g,'\\"')+'")' : null;
    var curVal = bg.style.backgroundImage;
    var sameImg = newVal ? (curVal===newVal) : (!curVal||curVal==='none'||curVal==='');
    if(sameImg) return;
    bg.style.opacity='0';
    TOP.setTimeout(function(){
      if(newVal){ bg.style.background=''; bg.style.backgroundImage=newVal; }
      else { bg.style.backgroundImage=''; bg.style.background='radial-gradient(circle at 30% 30%, #2a2a3a 0%, #0c0c11 80%)'; }
      bg.style.opacity='1';
      applyImgMode();
    }, 300);
  }
  function applyImgMode(){
    var blurEl=overlay.querySelector('#vnm-bg-blur');
    var mode=state.imgMode||'adaptive';
    if(mode==='contain'){
      bg.style.backgroundSize='contain';
      bg.style.backgroundPosition='center';
      if(blurEl){
        var curImg=bg.style.backgroundImage||'';
        blurEl.style.backgroundImage=curImg;
        blurEl.style.opacity=(curImg&&curImg!=='none'&&curImg!=='')?'1':'0';
      }
    }else{
      bg.style.backgroundSize='cover';
      bg.style.backgroundPosition='center';
      if(blurEl){blurEl.style.opacity='0';}
    }
  }

  function render(){
    const s = state.sentences[state.idx]; if (!s) return;
    textEl.textContent = s.text;
    const validCount = state.myImgs.filter(function(el){ return !!imgUrl(el); }).length;
    if (validCount > 0){
      progEl.innerHTML = (state.idx+1)+' / '+state.sentences.length+'&nbsp;&nbsp;&nbsp;['+validCount+'/'+state.myImgs.length+' 图]';
    } else {
      progEl.innerHTML = (state.idx+1)+' / '+state.sentences.length+'&nbsp;&nbsp;&nbsp;<span class="vnm-spinner"></span>等待图片生成…';
    }
    renderBg(urlForSentence(s));
  }

  function startPolling(){
    if (state.pollTimer) return;
    state.pollCount = 0;
    state.pollTimer = TOP.setInterval(function(){
      state.pollCount++;
      const fresh = findMyImages();
      console.log('[VNM v8.0] poll #'+state.pollCount+': '+fresh.length+'/'+state.imageCount+' imgs');
      if (fresh.length > 0){
        // Update display whenever we get new images
        const changed = fresh.length !== state.myImgs.length;
        state.myImgs = fresh;
        if (changed){
          render();
          // Clear regen loading if we got a new image
          if (state.regenPending){ state.regenPending = false; setRegenLoading(false); }
        }
        // Stop when we have all expected images, or timeout
        if (fresh.length >= state.imageCount || state.pollCount >= 90){
          stopPolling();
          setRegenLoading(false);
        }
      } else if (state.pollCount >= 90){
        stopPolling();
        setRegenLoading(false);
      }
    }, 2000);
  }
  function stopPolling(){
    if (state.pollTimer){ TOP.clearInterval(state.pollTimer); state.pollTimer = null; }
    if (state.regenPollTimer){ TOP.clearInterval(state.regenPollTimer); state.regenPollTimer = null; }
  }

  // 重新生成后轮询目标图 URL 变化，最多 4 次（每 2s），有变化即刷新
  function startRegenPoll(targetIdx, prevUrl){
    if (state.regenPollTimer){ TOP.clearInterval(state.regenPollTimer); state.regenPollTimer = null; }
    var pollCount = 0;
    state.regenPollTimer = TOP.setInterval(function(){
      pollCount++;
      var fresh = findMyImages();
      var el = fresh[targetIdx] !== undefined ? fresh[targetIdx] : fresh[0];
      var newUrl = el ? imgUrl(el) : null;
      console.log('[VNM] regenPoll #'+pollCount+' idx:'+targetIdx+' changed:'+(newUrl&&newUrl!==prevUrl));
      if (newUrl && newUrl !== prevUrl){
        TOP.clearInterval(state.regenPollTimer); state.regenPollTimer = null;
        state.myImgs = fresh;
        state.regenPending = false;
        setRegenLoading(false);
        render();
        showToast('已刷新第 '+(targetIdx+1)+' 张图片', 2200);
      } else if (pollCount >= 4){
        TOP.clearInterval(state.regenPollTimer); state.regenPollTimer = null;
        state.regenPending = false;
        setRegenLoading(false);
        showToast('未检测到第 '+(targetIdx+1)+' 张图片更新', 2200);
      }
    }, 2000);
  }

  function next(){ if (state.idx < state.sentences.length-1){ state.idx++; render(); } else { showToast('已是最后一段',1200); } }
  function prev(){ if (state.idx > 0){ state.idx--; render(); } else { showToast('已是第一段',1200); } }
  function toggleHide(){ state.hidden=!state.hidden; dialog.classList.toggle('vnm-hidden',state.hidden); }

  function setRegenLoading(on){
    if (!regenBtn) return;
    if (on){
      regenBtn.classList.add('vnm-loading');
      // Auto-clear after 35s in case NAI errors/rejects
      if (state.regenTimer) TOP.clearTimeout(state.regenTimer);
      state.regenTimer = TOP.setTimeout(function(){ setRegenLoading(false); }, 35000);
    } else {
      regenBtn.classList.remove('vnm-loading');
      if (state.regenTimer){ TOP.clearTimeout(state.regenTimer); state.regenTimer = null; }
    }
  }
  function regen(){
    const s = state.sentences[state.idx]; if (!s) return;
    const N = s.imgIdx;
    const targetIdx = state.myImgs.length > 0 ? Math.min(N, state.myImgs.length - 1) : 0;
    const btn = findRegenButton(targetIdx);
    if (btn){
      var prevUrl = state.myImgs[targetIdx] ? imgUrl(state.myImgs[targetIdx]) : null;
      btn.click();
      showToast('正在重新生成第 '+(targetIdx+1)+' 张图…', 3500);
      setRegenLoading(true);
      state.regenPending = true;
      if(state.autoPvp) pvpEnqueue(targetIdx);
      // 1.5s 后开始轮询 URL 变化，自动更新新图，不需要手动按确认图片生成
      TOP.setTimeout(function(){ startRegenPoll(targetIdx, prevUrl); }, 1500);
    } else {
      showToast('未找到生成按钮，重新扫描中…', 2500);
      stopPolling();
      state.myImgs = findMyImages();
      if (!state.myImgs.length) startPolling();
      render();
    }
  }

  function save(){
    const s = state.sentences[state.idx];
    const url = s ? urlForSentence(s) : null;
    if (!url){ alert('当前没有可用图片'); return; }
    const a = TOPDOC.createElement('a'); a.href=url; a.download='vn-'+Date.now()+'.png';
    TOPDOC.body.appendChild(a); a.click(); a.remove();
  }
  function sendToTavern(text){
    const ta = TOPDOC.querySelector('#send_textarea');
    if (!ta){ alert('未找到 #send_textarea'); return; }
    ta.value = text;
    try{ ta.dispatchEvent(new TOP.Event('input',{bubbles:true})); }catch(e){}
    const sb = TOPDOC.querySelector('#send_but');
    if (sb) sb.click();
    else if (TOP.jQuery) TOP.jQuery('#send_but').trigger('click');
  }
  function close(userExit){
    stopPolling();
    if(userExit){
      try{TOP.localStorage.removeItem('vnm-display-mode');}catch(e){}
      // Close all other open VN viewers so everything resets together
      try{
        TOPDOC.querySelectorAll('#chat .mes iframe').forEach(function(fr){
          try{
            if(fr===window.frameElement) return;
            var _w=fr.contentWindow;
            if(_w&&typeof _w._vnmClose==='function') _w._vnmClose();
          }catch(e){}
        });
      }catch(e){}
    }
    if(!_isInline){
      try{ if(TOPDOC.fullscreenElement) TOPDOC.exitFullscreen(); }catch(e){}
      // Restore iOS body scroll lock (web mode)
      if(_savedBodyStyle){
        try{
          TOPDOC.body.style.overflow=_savedBodyStyle.overflow;
          TOPDOC.body.style.position=_savedBodyStyle.position;
          TOPDOC.body.style.width=_savedBodyStyle.width;
          TOPDOC.body.style.top=_savedBodyStyle.top;
          if(_savedHtmlStyle!==null) TOPDOC.documentElement.style.overflow=_savedHtmlStyle;
          TOP.scrollTo(0,_savedScrollY);
        }catch(e){}
      }
      // Remove visualViewport resize listener
      if(_vvHandler&&TOP.visualViewport){
        try{ TOP.visualViewport.removeEventListener('resize',_vvHandler); }catch(e){}
        try{ TOP.visualViewport.removeEventListener('scroll',_vvHandler); }catch(e){}
      }
    }
    else { try{ var _fe=window.frameElement; if(_fe&&_origFrameStyle!==null){ _fe.style.cssText=_origFrameStyle; _fe.removeAttribute('height'); } }catch(e){} }
    overlay.classList.add('vnm-fading');
    setTimeout(function(){ overlay.remove(); }, 250);
    TOPDOC.removeEventListener('keydown', onKey);
    try{ document.removeEventListener('keydown', onKey); }catch(e){}
    try{ delete TOP._vnmInject; }catch(e){}
    try{ window._vnmClose=null; }catch(e){}
  }

    (function(){
    var _cl=overlay.querySelector('#vnm-click-layer');
    _cl.addEventListener('click',function(){
      if(state.settingsOpen){closeSettings();return;}
      if(state.hidden){toggleHide();return;}
      next();
    });
  })();
  ctrlBar.addEventListener('click', function(e){
    const b = e.target.closest('button[data-act]'); if (!b) return; e.stopPropagation();
    const a = b.dataset.act;
    if (a==='toggle-bar') toggleCtrlBar();
    else if (a==='next') next();
    else if (a==='prev') prev();
    else if (a==='regen') regen();
    else if (a==='save') save();
    else if (a==='settings') toggleSettings();
    else if (a==='hide') toggleHide();
    else if (a==='sync') syncImages();
    else if (a==='autopvp') toggleAutoPvp();
    else if (a==='prev-turn') prevTurn();
    else if (a==='next-turn') nextTurn();
    else if (a==='close') close(true);
    else if(a==='sb-toggle'){
      var _exSb=TOPDOC.getElementById('vnm-statusbar');
      if(_exSb){
        var _show=_exSb.style.display==='none';
        _exSb.style.display=_show?'flex':'none';
        try{var _sd=JSON.parse(TOP.localStorage.getItem('vnm-statusbar-v2')||'{}');_sd.visible=_show;TOP.localStorage.setItem('vnm-statusbar-v2',JSON.stringify(_sd));}catch(_se){}
        b.style.color=_show?'rgba(255,255,255,.92)':'rgba(255,255,255,.38)';
        b.style.background=_show?'rgba(255,255,255,.12)':'transparent';
        b.style.borderColor=_show?'rgba(255,255,255,.18)':'transparent';
      }
    }
  });
    (function(){
    function _dlgNav(clientX,rect){
      if(clientX<rect.left+rect.width/2) prev(); else next();
    }
    dialog.addEventListener('click',function(e){
      e.stopPropagation();
      if(state.settingsOpen){closeSettings();return;}
      if(e.target.closest('.vnm-controls')||e.target.closest('#vnm-ctrl-bar')||e.target.closest('#vnm-settings')) return;
      _dlgNav(e.clientX, dialog.getBoundingClientRect());
    });
  })();
  [textEl,progEl].forEach(function(el){ el.style.cursor='default'; });
  input.addEventListener('keydown', function(e){
    if (e.key==='Enter' && !e.shiftKey){
      e.preventDefault();
      const v = input.value.trim(); if (!v) return;
      input.value='';
      var _inj=_sbInjectFn();
      var _msg=_inj?'【上一轮对话的世界信息包括：'+_inj+'】'+v:v;
      if(state.stayMode){
        sendToTavern(_msg); showSentState();
      } else {
        close(); setTimeout(function(){ sendToTavern(_msg); }, 300);
      }
    }
  });
  function onKey(e){
    if (TOPDOC.activeElement === input && e.key!=='Escape') return;
    if (e.key==='Escape'){ e.preventDefault(); close(true); }
    else if (e.key==='ArrowRight'||e.key===' '){ e.preventDefault(); next(); }
    else if (e.key==='ArrowLeft'){ e.preventDefault(); prev(); }
    else if (e.key==='h'||e.key==='H'){ e.preventDefault(); toggleHide(); }
  }
  TOPDOC.addEventListener('keydown', onKey);
  if(_isInline) document.addEventListener('keydown', onKey);
  if(!_isInline && mode==='fullscreen'){
    try{
      const req = overlay.requestFullscreen || overlay.webkitRequestFullscreen;
      if (req){ const p = req.call(overlay); if (p && p.catch) p.catch(function(){}); }
    }catch(e){}
    // Close overlay if browser exits fullscreen by any means
    var _fsHandler=function(){
      if(!TOPDOC.fullscreenElement&&!TOPDOC.webkitFullscreenElement){
        TOPDOC.removeEventListener('fullscreenchange',_fsHandler);
        TOPDOC.removeEventListener('webkitfullscreenchange',_fsHandler);
        close(true);
      }
    };
    TOPDOC.addEventListener('fullscreenchange',_fsHandler);
    TOPDOC.addEventListener('webkitfullscreenchange',_fsHandler);
  }

  // ═══════════════════════════════════════════════════════
  // VNM Status Bar v2.1  (iOS-style UI)
  // ═══════════════════════════════════════════════════════
  // Bridge: set by setupStatusBar, called by Enter handler
  var _sbInjectFn=function(){return'';};
  (function setupStatusBar(){
    try {

    /* ── Guard: prevent double-init on every ST message ── */
    var _existing=TOPDOC.getElementById('vnm-statusbar');
    if(_existing&&_existing.getAttribute('data-lgv')!=='2'){try{_existing.parentNode.removeChild(_existing);}catch(e){}_existing=null;}
    if(_existing){
      /* Panel already exists — just re-sync toggle button */
      (function(){
        var t=overlay.querySelector('#vnm-btn-sb-toggle');
        if(!t)return;
        var vis=_existing.style.display!=='none';
        t.style.color=vis?'rgba(255,255,255,.92)':'rgba(255,255,255,.38)';
        t.style.background=vis?'rgba(255,255,255,.12)':'transparent';
        t.style.borderColor=vis?'rgba(255,255,255,.18)':'transparent';
        /* Ensure only one click listener via flag */
        if(!t._v8bound){
          t._v8bound=true;
          t.addEventListener('click',function(e){
            e.stopPropagation();
            var show=_existing.style.display==='none';
            _existing.style.display=show?'flex':'none';
            var SB_KEY2='vnm-statusbar-v2';
            try{var d2=JSON.parse(TOP.localStorage.getItem(SB_KEY2)||'{}');d2.visible=show;TOP.localStorage.setItem(SB_KEY2,JSON.stringify(d2));}catch(ex){}
            t.style.color=show?'rgba(255,255,255,.92)':'rgba(255,255,255,.38)';
            t.style.background=show?'rgba(255,255,255,.12)':'transparent';
            t.style.borderColor=show?'rgba(255,255,255,.18)':'transparent';
          });
        }
      })();
      return;
    }

    var SB_KEY='vnm-statusbar-v2';
    function _L(){try{return JSON.parse(TOP.localStorage.getItem(SB_KEY)||'{}');}catch(e){return{};}}
    function _W(){try{TOP.localStorage.setItem(SB_KEY,JSON.stringify(_sbS));}catch(e){}}
    function _applyGlass(el){
      var sh=el||TOPDOC.getElementById('vnm-v8');if(!sh)return;
      var _w=TOPDOC.getElementById('vnm-statusbar');var _tg=[sh];if(_w&&_w!==sh)_tg.push(_w);
      _tg=_tg.filter(Boolean);var _set=function(k,v){for(var i=0;i<_tg.length;i++)_tg[i].style.setProperty(k,v);};
      var g=function(k,d){var o=_sbS.glassUI||{};return(o[k]===undefined||o[k]===null)?d:o[k];};
      /* 背景面板组 */
      _set('--g-blur',g('bgBlur',0)+'px');
      _set('--g-tint','rgba(255,255,255,'+(g('bgTint',0)/100)+')');
      _set('--g-sat',g('bgSat',160)+'%');
      _set('--g-filter',g('refract',1)?'url(#vnm-lg-bg)':'none');
      /* 按钮与组件组 */
      _set('--ge-blur',g('elBlur',1.5)+'px');
      _set('--ge-tint','rgba(255,255,255,'+(g('elTint',1)/100)+')');
      _set('--ge-sat',g('elSat',160)+'%');
      _set('--ge-filter',g('refract',1)?'url(#vnm-lg-el)':'none');
      /* 通用 */
      _set('--g-bright',(g('bright',90)/100));
      _set('--g-hl',(g('hl',20)/100));
      _set('--g-rad',g('radius',32)+'px');
      _set('--g-bg','rgba(8,8,14,'+(g('dim',23)/100)+')');
      /* 更新两组液态玻璃滤镜：折射强度 + 中心清晰区 */
      function _msk(z){
        TOP._lgMaskCache=TOP._lgMaskCache||{};
        if(TOP._lgMaskCache[z])return TOP._lgMaskCache[z];
        var cv=TOPDOC.createElement('canvas');cv.width=256;cv.height=256;
        var cx=cv.getContext('2d');
        var half=128,corner=half*Math.SQRT2;
        var r0=Math.min(z/100*half,corner-1);
        var gr=cx.createRadialGradient(half,half,r0,half,half,corner);
        gr.addColorStop(0,'#000');gr.addColorStop(1,'#fff');
        cx.fillStyle='#000';cx.fillRect(0,0,256,256);
        cx.fillStyle=gr;cx.fillRect(0,0,256,256);
        var u=cv.toDataURL('image/png');TOP._lgMaskCache[z]=u;return u;
      }
      function _upd(fid,refr,zone){try{var f=TOPDOC.getElementById(fid);if(!f)return;var im=f.querySelector('feImage');if(im){var u=_msk(zone);im.setAttribute('href',u);try{im.setAttributeNS('http://www.w3.org/1999/xlink','href',u);}catch(e2){}}var dm=f.querySelector('feDisplacementMap');if(dm)dm.setAttribute('scale',String(refr));}catch(e){}}
      _upd('vnm-lg-bg',g('bgRefr',60),g('bgZone',95));
      _upd('vnm-lg-el',g('elRefr',60),g('elZone',95));
    }
    var _d=_L();
    var _sbS={
      apiUrl:        _d.apiUrl        ||'',
      apiPresets:    _d.apiPresets    ||[],
      userPresets:   _d.userPresets   ||[],
      apiKey:        _d.apiKey        ||'',
      model:         _d.model         ||'',
      turnCount:     (_d.turnCount     !==undefined)?_d.turnCount    :6,
      pos:           _d.pos           ||{x:Math.max(20,TOP.innerWidth-380),y:60},
      size:          _d.size          ||{w:370,h:580},
      visible:       ('visible' in _d)?_d.visible:false,
      presets:       _d.presets       ||[],
      activePresetId:_d.activePresetId||null,
      user:          _d.user          ||{name:'',persona:''},
      characters:    _d.characters    ||[],
      activeCharIds: _d.activeCharIds ||[],
      history:       _d.history       ||{},
      wbEntries:     _d.wbEntries     ||[],
      wbActive:      _d.wbActive      ||[],
      wbGroupDisabled:_d.wbGroupDisabled||{},
      injectCharIds: _d.injectCharIds ||[],
      ttsEnabled:    (_d.ttsEnabled    !==undefined)?_d.ttsEnabled   :false,
      ttsGroupId:    _d.ttsGroupId    ||'',
      ttsApiKey:     _d.ttsApiKey     ||'',
      ttsApiHost:    _d.ttsApiHost    ||'https://api.minimax.chat',
      ttsModel:      _d.ttsModel      ||'speech-02-hd',
      vnmApps:      _d.vnmApps       ||[],
      callHistory:  _d.callHistory   ||[],
      vcSystemPrompt:_d.vcSystemPrompt||null,
      vcContextDepth:(_d.vcContextDepth!==undefined)?_d.vcContextDepth:6,
      glassUI:      _d.glassUI       ||{}
    };
    var _ui={settingsOpen:false,tab:'api',loading:false,charIdx:0,histIdx:{},editPresetId:null,editCharId:null,wbCollapsed:{}};
    function _uuid(){return Date.now().toString(36)+Math.random().toString(36).substr(2);}
    function _esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    function _ap(){return _sbS.presets.find(function(p){return p.id===_sbS.activePresetId;})||null;}
    function _ac(){return _sbS.activeCharIds.map(function(id){return _sbS.characters.find(function(c){return c.id===id;});}).filter(Boolean);}

    // ── iOS color tokens ──────────────────────────────────
    /* ── DOM helpers (used by all _render* tabs) ── */
    function _el(tag,cls,html){var e=TOPDOC.createElement(tag);if(cls)e.className=cls;if(html)e.innerHTML=html;return e;}
    function _div(cls,html){return _el('div',cls,html);}
    function _svg(path,sz){sz=sz||18;return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24">'+path+'</svg>';}

        var C={
      bg:       'rgba(12,12,18,0.12)',
      surface:  'rgba(255,255,255,0.055)',
      surface2: 'rgba(255,255,255,0.09)',
      border:   'rgba(255,255,255,0.07)',
      border2:  'rgba(255,255,255,0.13)',
      text:     'rgba(255,255,255,0.88)',
      text2:    'rgba(255,255,255,0.50)',
      text3:    'rgba(255,255,255,0.28)',
      blue:     'rgba(255,255,255,0.92)',
      blueB:    'rgba(255,255,255,0.13)',
      blueB2:   'rgba(255,255,255,0.22)',
      green:    'rgba(255,255,255,0.75)',
      greenB:   'rgba(255,255,255,0.09)',
      red:      'rgba(255,255,255,0.45)',
      redB:     'rgba(255,255,255,0.06)',
    };

    // ── Root panel ────────────────────────────────────────
    function _addPress(el){el.addEventListener('mousedown',function(){el.style.transform='scale(0.88)';el.style.opacity='0.7';});el.addEventListener('mouseup',function(){el.style.transform='';el.style.opacity='';});el.addEventListener('mouseleave',function(){el.style.transform='';el.style.opacity='';});}
    _sb=TOPDOC.createElement('div');
    _sb.id='vnm-statusbar';
    _sb.setAttribute('data-lgv','2');
    _sb.style.cssText=
      'position:absolute;z-index:2147483620;'
      +'left:'+_sbS.pos.x+'px;top:'+_sbS.pos.y+'px;'
      +'width:'+_sbS.size.w+'px;height:'+_sbS.size.h+'px;'
      +'background:transparent;'
      +'border:.5px solid rgba(255,255,255,0.22);'
      +'border-radius:30px;'
      +'box-shadow:0 24px 80px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.28),inset 0 0 0 .5px rgba(255,255,255,0.10);'
      +'display:flex;flex-direction:column;overflow:hidden;'
      +'font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif;'
      +'color:'+C.text+';user-select:none;-webkit-user-select:none;';
    if(!_sbS.visible)_sb.style.display='none';
    var _sbGlass=TOPDOC.createElement('div');
    _sbGlass.id='vnm-sb-glass';
    _sbGlass.style.cssText='position:absolute;inset:0;border-radius:30px;z-index:-1;pointer-events:none;'
      +'background:var(--g-tint,rgba(255,255,255,0));'
      +'backdrop-filter:blur(var(--g-blur,0px)) saturate(var(--g-sat,160%)) brightness(var(--g-bright,1));'
      +'-webkit-backdrop-filter:blur(var(--g-blur,0px)) saturate(var(--g-sat,160%)) brightness(var(--g-bright,1));'
      +'filter:var(--g-filter,url(#vnm-lg-bg));';
    _sb.appendChild(_sbGlass);

    // ── Header ────────────────────────────────────────────
    var _head=TOPDOC.createElement('div');
    _head.style.cssText=
      'display:flex;align-items:center;justify-content:flex-end;'
      +'padding:4px 8px 4px;cursor:grab;flex-shrink:0;height:32px;';

    var _title=TOPDOC.createElement('span');
    _title.style.cssText=
      'font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;'
      +'color:rgba(255,255,255,0.25);pointer-events:none;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    _title.textContent='';

    var _hbtns=TOPDOC.createElement('div');
    _hbtns.style.cssText='display:flex;gap:6px;align-items:center;flex-shrink:0;';

    function _SVG(d,sz){
      sz=sz||14;
      return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
    }
    function _mkHBtn(title,svgD){
      var b=TOPDOC.createElement('button');b.title=title;
      b.style.cssText=
        'width:28px;height:28px;border:none;cursor:pointer;'
        +'background:'+C.surface2+';color:'+C.text2+';'
        +'border-radius:50%;display:inline-flex;align-items:center;justify-content:center;'
        +'transition:all .12s ease;padding:0;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.2);';
      b.innerHTML=_SVG(svgD);
      b.addEventListener('mouseenter',function(){this.style.background='rgba(255,255,255,0.18)';this.style.color=C.text;});
      b.addEventListener('mouseleave',function(){this.style.background=C.surface2;this.style.color=C.text2;});
      _addPress(b);
      return b;
    }
    var _refreshBtn=_mkHBtn('刷新状态','<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>');
    var _settBtn=_mkHBtn('设置','<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
    var _closeBtn=_mkHBtn('隐藏','<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
    var _previewBtn=_mkHBtn('查看提示词','<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>');
    _previewBtn.addEventListener('click',function(e){
      e.stopPropagation();
      // Build current prompt
      var ac=_ac();
      var ctx='';try{ctx=getRawSource();}catch(er){}
      if(!ctx)ctx=state.sentences.map(function(s){return s.text;}).join('\n');
      var sys=_buildPrompt(ac);
      // Show modal
      var modal=TOPDOC.createElement('div');
      modal.style.cssText='position:absolute;inset:0;z-index:9999;background:rgba(10,10,14,0.92);display:flex;flex-direction:column;border-radius:inherit;overflow:hidden;';
      var mHead=TOPDOC.createElement('div');
      mHead.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:0.5px solid rgba(255,255,255,0.08);flex-shrink:0;';
      var mTitle=TOPDOC.createElement('span');
      mTitle.style.cssText='font-size:12px;font-weight:600;color:rgba(255,255,255,0.7);letter-spacing:.4px;';
      mTitle.textContent='完整提示词预览';
      var mBtns=TOPDOC.createElement('div');mBtns.style.cssText='display:flex;gap:6px;';
      var copyB=_pbtn('复制 System','default');
      copyB.addEventListener('click',function(e){
        e.stopPropagation();
        try{TOP.navigator.clipboard.writeText(sys).then(function(){_toast('已复制 System Prompt');});} catch(er){_toast('复制失败');}
      });
      var copyAllB=_pbtn('复制全部','default');
      copyAllB.addEventListener('click',function(e){
        e.stopPropagation();
        var all='[SYSTEM]\n'+sys+'\n\n[USER]\n'+ctx;
        try{TOP.navigator.clipboard.writeText(all).then(function(){_toast('已复制完整消息');});} catch(er){_toast('复制失败');}
      });
      var closeM=TOPDOC.createElement('button');
      closeM.style.cssText='background:transparent;border:none;color:rgba(255,255,255,0.45);cursor:pointer;font-size:18px;line-height:1;padding:0 2px;';
      closeM.textContent='×';
      closeM.addEventListener('click',function(e){e.stopPropagation();_sb.removeChild(modal);});
      mBtns.appendChild(copyB);mBtns.appendChild(copyAllB);mBtns.appendChild(closeM);
      mHead.appendChild(mTitle);mHead.appendChild(mBtns);
      modal.appendChild(mHead);
      // Sections
      function _sec(label, txt){
        var wrap=TOPDOC.createElement('div');wrap.style.cssText='display:flex;flex-direction:column;flex:1;overflow:hidden;';
        var lbl=TOPDOC.createElement('div');
        lbl.style.cssText='font-size:10px;font-weight:600;letter-spacing:.8px;color:rgba(255,255,255,0.3);text-transform:uppercase;padding:8px 14px 4px;flex-shrink:0;';
        lbl.textContent=label;
        var pre=TOPDOC.createElement('textarea');
        pre.readOnly=true;pre.value=txt;
        pre.style.cssText='flex:1;background:transparent;border:none;border-top:0.5px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.75);font-size:11px;line-height:1.6;padding:10px 14px;resize:none;outline:none;font-family:ui-monospace,monospace;overflow-y:auto;';
        wrap.appendChild(lbl);wrap.appendChild(pre);
        return wrap;
      }
      var sysBox=_sec('System Prompt',sys);
      sysBox.style.flex='2';
      var userBox=_sec('User (当前对话内容)',ctx);
      userBox.style.flex='1';
      var sep=TOPDOC.createElement('div');sep.style.cssText='height:0.5px;background:rgba(255,255,255,0.07);flex-shrink:0;';
      modal.appendChild(sysBox);modal.appendChild(sep);modal.appendChild(userBox);
      _sb.appendChild(modal);
    });
    [_closeBtn].forEach(function(b){_hbtns.appendChild(b);});
    _head.appendChild(_title);_head.appendChild(_hbtns);

    // ── Settings area ─────────────────────────────────────
    var _settArea=TOPDOC.createElement('div');
    _settArea.style.cssText=
      'display:none;flex-direction:column;flex-shrink:0;'
      +'border-bottom:0.5px solid '+C.border+';max-height:66%;';

    // iOS segmented control
    var _segWrap=TOPDOC.createElement('div');
    _segWrap.style.cssText=
      'padding:9px 12px 8px;flex-shrink:0;';
    var _seg=TOPDOC.createElement('div');
    _seg.style.cssText=
      'display:flex;background:rgba(118,118,128,0.18);border-radius:10px;padding:2px;gap:1px;';
    var _tabs={};
    [['api','API'],['presets','预设'],['chars','角色'],['wb','世界书'],['phone','功能系统']].forEach(function(pair){
      var tb=TOPDOC.createElement('button');
      tb.style.cssText=
        'flex:1;padding:6px 4px;background:transparent;border:none;border-radius:8px;'
        +'color:'+C.text3+';font-size:12px;font-weight:500;cursor:pointer;'
        +'letter-spacing:.3px;transition:all .18s;font-family:inherit;white-space:nowrap;';
      tb.textContent=pair[1];
      tb.addEventListener('click',function(e){e.stopPropagation();_setTab(pair[0]);});
      _tabs[pair[0]]=tb;_seg.appendChild(tb);
    });
    _segWrap.appendChild(_seg);

    var _tabBody=TOPDOC.createElement('div');
    _tabBody.id='vnm-sb-tab';
    _tabBody.style.cssText=
      'overflow-y:auto;flex:1;min-height:0;padding:0 12px 10px;'
      +'scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.12) transparent;';

    _settArea.appendChild(_segWrap);_settArea.appendChild(_tabBody);

    function _setTab(id){
      _ui.tab=id;
      Object.keys(_tabs).forEach(function(k){
        var a=k===id;
        _tabs[k].style.background=a?'rgba(255,255,255,0.14)':'transparent';
        _tabs[k].style.color=a?C.text:C.text3;
        _tabs[k].style.boxShadow=a?'0 1px 4px rgba(0,0,0,0.25)':'none';
      });
      _renderTab();
    }

    // ── Widget factories (iOS-style) ───────────────────────
    function _inp(ph,tp,val){
      var i=TOPDOC.createElement('input');
      i.type=tp||'text';i.placeholder=ph||'';if(val!==undefined)i.value=val;
      i.style.cssText=
        'width:100%;box-sizing:border-box;padding:9px 12px;'
        +'background:'+C.surface+';border:none;border-radius:10px;'
        +'color:'+C.text+';font-size:13px;outline:none;font-family:inherit;'
        +'transition:background .15s;';
      i.addEventListener('focus',function(){this.style.background=C.surface2;});
      i.addEventListener('blur', function(){this.style.background=C.surface;});
      i.addEventListener('mousedown',function(e){e.stopPropagation();});
      i.addEventListener('keydown',  function(e){e.stopPropagation();});
      i.addEventListener('click',    function(e){e.stopPropagation();});
      return i;
    }
    function _ta(ph,val,rows){
      var t=TOPDOC.createElement('textarea');
      t.placeholder=ph||'';if(val!==undefined)t.value=val;t.rows=rows||4;
      t.style.cssText=
        'width:100%;box-sizing:border-box;padding:9px 12px;'
        +'background:'+C.surface+';border:none;border-radius:10px;'
        +'color:'+C.text+';font-size:12px;outline:none;font-family:inherit;'
        +'resize:vertical;min-height:60px;line-height:1.55;transition:background .15s;';
      t.addEventListener('focus',function(){this.style.background=C.surface2;});
      t.addEventListener('blur', function(){this.style.background=C.surface;});
      t.addEventListener('mousedown',function(e){e.stopPropagation();});
      t.addEventListener('keydown',  function(e){e.stopPropagation();});
      t.addEventListener('click',    function(e){e.stopPropagation();});
      return t;
    }
    function _lbl(text){
      var l=TOPDOC.createElement('div');
      l.style.cssText=
        'font-size:11px;font-weight:500;color:'+C.text2+';'
        +'margin-top:12px;margin-bottom:5px;letter-spacing:.2px;';
      l.textContent=text;return l;
    }
    // iOS-style grouped list card (wraps multiple rows)
    function _card(){
      var d=TOPDOC.createElement('div');
      d.style.cssText=
        'background:'+C.surface+';border-radius:14px;overflow:hidden;margin-top:8px;';
      return d;
    }
    function _cardRow(leftEl,rightEl,sep){
      var r=TOPDOC.createElement('div');
      r.style.cssText='display:flex;align-items:center;gap:8px;padding:10px 12px;';
      if(sep){
        var s=TOPDOC.createElement('div');
        s.style.cssText='height:0.5px;background:'+C.border+';margin:0 12px;';
        r._sep=s;
      }
      if(leftEl)r.appendChild(leftEl);
      if(rightEl)r.appendChild(rightEl);
      return r;
    }
    // Pill action button
    function _pbtn(text,variant){
      // variant: 'default'|'blue'|'green'|'red'
      var b=TOPDOC.createElement('button');b.textContent=text;
      var styles={
        'default': 'background:'+C.surface2+';color:'+C.text2+';border:0.5px solid '+C.border2+';',
        'blue':    'background:'+C.blueB+';color:'+C.blue+';border:0.5px solid '+C.blueB2+';',
        'green':   'background:'+C.greenB+';color:'+C.green+';border:0.5px solid '+C.border2+';',
        'red':     'background:transparent;color:'+C.red+';border:none;',
      };
      b.style.cssText=
        'padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;'
        +'font-family:inherit;border:none;transition:opacity .13s;white-space:nowrap;flex-shrink:0;'
        +(styles[variant||'default']||styles['default']);
      b.addEventListener('mouseenter',function(){this.style.opacity='.78';});
      b.addEventListener('mouseleave',function(){this.style.opacity='1';});
      b.addEventListener('mousedown',function(e){e.stopPropagation();});
      b.addEventListener('click',    function(e){e.stopPropagation();});
      return b;
    }
    function _row(){var d=TOPDOC.createElement('div');d.style.cssText='display:flex;gap:7px;align-items:center;';return d;}
    function _numinp(val,mn,mx){
      var i=TOPDOC.createElement('input');i.type='number';i.min=mn||0;i.max=mx||999;i.value=val||0;
      i.style.cssText=
        'width:62px;padding:6px 8px;background:'+C.surface+';border:none;'
        +'border-radius:8px;color:'+C.text+';font-size:13px;outline:none;font-family:inherit;text-align:center;';
      i.addEventListener('mousedown',function(e){e.stopPropagation();});
      i.addEventListener('keydown',  function(e){e.stopPropagation();});
      i.addEventListener('click',    function(e){e.stopPropagation();});
      return i;
    }
    function _unit(t){
      var s=TOPDOC.createElement('span');
      s.style.cssText='font-size:12px;color:'+C.text3+';';
      s.textContent=t;return s;
    }

    // ── Tab: API ─────────────────────────────────────────
    function _renderApiTab(){
      var f=_div('');f.style.cssText='padding-bottom:24px;';

      /* ── Section: API 连接 ── */
      var secConn=_div('v8sec','API 连接');f.appendChild(secConn);
      var cardConn=_div('v8card');

      /* URL row */
      var urlRow=_div('v8row');urlRow.style.flexDirection='column';urlRow.style.alignItems='stretch';urlRow.style.padding='12px 14px';urlRow.style.gap='6px';
      var urlLbl=_div('');urlLbl.style.cssText='font-size:11px;color:rgba(255,255,255,.38);font-weight:500;letter-spacing:.3px;';urlLbl.textContent='API 地址';
      var urlI=TOPDOC.createElement('input');urlI.className='v8fi';urlI.type='url';urlI.placeholder='https://api.example.com/v1';urlI.value=_sbS.apiUrl||'';
      urlI.addEventListener('mousedown',function(e){e.stopPropagation();});
      urlI.addEventListener('change',function(){_sbS.apiUrl=this.value.trim();_W();});
      urlRow.appendChild(urlLbl);urlRow.appendChild(urlI);
      cardConn.appendChild(urlRow);

      /* separator */
      var sepA=_div('');sepA.style.cssText='height:.5px;background:rgba(255,255,255,.06);margin:0 14px;';cardConn.appendChild(sepA);

      /* Key row */
      var keyRow=_div('v8row');keyRow.style.flexDirection='column';keyRow.style.alignItems='stretch';keyRow.style.padding='12px 14px';keyRow.style.gap='6px';
      var keyLbl=_div('');keyLbl.style.cssText='font-size:11px;color:rgba(255,255,255,.38);font-weight:500;letter-spacing:.3px;';keyLbl.textContent='API 密钥';
      var keyI=TOPDOC.createElement('input');keyI.className='v8fi';keyI.type='password';keyI.placeholder='sk-…';keyI.value=_sbS.apiKey||'';
      keyI.addEventListener('mousedown',function(e){e.stopPropagation();});
      keyI.addEventListener('change',function(){_sbS.apiKey=this.value.trim();_W();});
      keyRow.appendChild(keyLbl);keyRow.appendChild(keyI);
      cardConn.appendChild(keyRow);
      f.appendChild(cardConn);

      /* ── Section: 模型 ── */
      f.appendChild(_div('v8sec','模型'));
      var cardModel=_div('v8card');
      var modelRow=_div('v8row');modelRow.style.gap='8px';modelRow.style.padding='10px 14px';
      var modelSel=TOPDOC.createElement('select');modelSel.className='v8fi';modelSel.style.flex='1';modelSel.style.appearance='none';modelSel.style.webkitAppearance='none';
      modelSel.addEventListener('mousedown',function(e){e.stopPropagation();});
      modelSel.addEventListener('change',function(){_sbS.model=this.value;_W();});
      function _populateModel(models,selected){
        modelSel.innerHTML='';
        if(!models||!models.length){var o=TOPDOC.createElement('option');o.value='';o.textContent='暂无模型';modelSel.appendChild(o);return;}
        models.forEach(function(m){var o=TOPDOC.createElement('option');o.value=m;o.textContent=m;if(m===selected)o.selected=true;modelSel.appendChild(o);});
        if(!selected&&models.length){_sbS.model=models[0];_W();}
      }
      _populateModel(_sbS.model?[_sbS.model]:['(未选择)'],_sbS.model);
      var fetchBtn=TOPDOC.createElement('button');
      fetchBtn.style.cssText='padding:7px 13px;background:rgba(255,255,255,.1);border:.5px solid rgba(255,255,255,.15);border-radius:10px;color:rgba(255,255,255,.82);font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;flex-shrink:0;font-family:inherit;';
      fetchBtn.textContent='拉取';
      fetchBtn.addEventListener('mousedown',function(e){e.stopPropagation();});
      fetchBtn.addEventListener('click',function(e){
        e.stopPropagation();
        _sbS.apiUrl=urlI.value.trim();_sbS.apiKey=keyI.value.trim();
        if(!_sbS.apiUrl){_toast('请先填写 API URL');return;}
        fetchBtn.textContent='…';fetchBtn.disabled=true;
        var base=_sbS.apiUrl.replace(/\/chat\/completions\/?$/,'').replace(/\/+$/,'');
        var hdrs={'Content-Type':'application/json'};
        if(_sbS.apiKey)hdrs['Authorization']='Bearer '+_sbS.apiKey;
        TOP.fetch(base+'/models',{headers:hdrs})
          .then(function(r){return r.json();})
          .then(function(data){
            var models=[];
            if(data.data&&Array.isArray(data.data))models=data.data.map(function(m){return m.id||m.name||String(m);});
            else if(Array.isArray(data))models=data.map(function(m){return m.id||m.name||String(m);});
            if(!models.length){_toast('未找到模型');return;}
            _populateModel(models,_sbS.model||models[0]);
            _sbS.model=modelSel.value;_W();_toast('已拉取 '+models.length+' 个模型');
          })
          .catch(function(err){_toast('拉取失败: '+err.message);})
          .finally(function(){fetchBtn.textContent='拉取';fetchBtn.disabled=false;});
      });
      modelRow.appendChild(modelSel);modelRow.appendChild(fetchBtn);
      cardModel.appendChild(modelRow);
      f.appendChild(cardModel);

      /* ── Section: 参数 ── */
      f.appendChild(_div('v8sec','参数'));
      var cardParam=_div('v8card');
      var tcRow=_div('v8row');tcRow.style.padding='12px 14px';
      var tcLeft=_div('v8rb');
      tcLeft.innerHTML='<div class="v8rt">拉取最近对话</div><div class="v8rs">构建聊天历史变量的轮数（0–50）</div>';
      var tcWrap=_div('');tcWrap.style.cssText='display:flex;align-items:center;gap:6px;flex-shrink:0;';
      var tcI=TOPDOC.createElement('input');tcI.type='number';tcI.min='0';tcI.max='50';tcI.value=_sbS.turnCount||6;
      tcI.style.cssText='width:52px;padding:5px 8px;background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.12);border-radius:8px;color:rgba(255,255,255,.88);font-size:13px;text-align:center;font-family:inherit;outline:none;';
      tcI.addEventListener('mousedown',function(e){e.stopPropagation();});
      tcI.addEventListener('change',function(){_sbS.turnCount=Math.max(0,Math.min(50,parseInt(this.value)||0));_W();});
      var tcUnit=_div('');tcUnit.style.cssText='font-size:12px;color:rgba(255,255,255,.38);';tcUnit.textContent='轮';
      tcWrap.appendChild(tcI);tcWrap.appendChild(tcUnit);
      tcRow.appendChild(tcLeft);tcRow.appendChild(tcWrap);
      cardParam.appendChild(tcRow);
      f.appendChild(cardParam);

      /* ── Section: API 预设 ── */
      f.appendChild(_div('v8sec','API 预设'));
      var cardPreset=_div('v8card');
      /* save current as preset */
      var psaveRow=_div('v8row tap');psaveRow.style.padding='12px 14px';
      var psaveLbl=_div('v8rb');psaveLbl.innerHTML='<div class="v8rt">保存当前配置为预设</div>';
      psaveRow.appendChild(_div('v8ic',_svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')));
      psaveRow.appendChild(psaveLbl);
      psaveRow.addEventListener('click',function(e){
        e.stopPropagation();
        var nm=TOP.prompt('预设名称：');if(!nm)return;
        if(!_sbS.apiPresets)_sbS.apiPresets=[];
        _sbS.apiPresets.push({id:_uuid(),name:nm,url:_sbS.apiUrl,key:_sbS.apiKey,model:_sbS.model});
        _W();if(TOP._v8draw)TOP._v8draw();_toast('预设已保存');
      });
      cardPreset.appendChild(psaveRow);
      /* list presets */
      if(_sbS.apiPresets&&_sbS.apiPresets.length){
        _sbS.apiPresets.forEach(function(p,pi){
          var sepP=_div('');sepP.style.cssText='height:.5px;background:rgba(255,255,255,.06);margin:0 14px;';cardPreset.appendChild(sepP);
          var pr=_div('v8row tap');pr.style.padding='12px 14px';
          var prb=_div('v8rb');prb.innerHTML='<div class="v8rt">'+p.name+'</div><div class="v8rs">'+(p.model||'未知模型')+'</div>';
          var pActions=_div('');pActions.style.cssText='display:flex;gap:6px;flex-shrink:0;';
          var applyB=TOPDOC.createElement('button');
          applyB.style.cssText='padding:5px 11px;background:rgba(255,255,255,.1);border:.5px solid rgba(255,255,255,.15);border-radius:9px;color:rgba(255,255,255,.8);font-size:11px;font-weight:500;cursor:pointer;font-family:inherit;';
          applyB.textContent='应用';
          applyB.addEventListener('mousedown',function(e){e.stopPropagation();});
          applyB.addEventListener('click',function(e){
            e.stopPropagation();_sbS.apiUrl=p.url;_sbS.apiKey=p.key;_sbS.model=p.model;
            urlI.value=p.url||'';keyI.value=p.key||'';
            _populateModel([p.model||''],p.model);_W();_toast('"'+p.name+'" 已应用');
          });
          var delB=TOPDOC.createElement('button');
          delB.style.cssText='padding:5px 11px;background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.16);border-radius:9px;color:rgba(255,255,255,.85);font-size:11px;font-weight:500;cursor:pointer;font-family:inherit;';
          delB.textContent='删除';
          delB.addEventListener('mousedown',function(e){e.stopPropagation();});
          delB.addEventListener('click',(function(idx2){return function(e){
            e.stopPropagation();_sbS.apiPresets.splice(idx2,1);_W();
            if(TOP._v8draw)TOP._v8draw();_toast('已删除');
          };})(pi));
          pActions.appendChild(applyB);pActions.appendChild(delB);
          pr.appendChild(prb);pr.appendChild(pActions);
          cardPreset.appendChild(pr);
        });
      } else {
        var noP=_div('v8row');noP.style.padding='10px 14px';noP.style.cursor='default';
        noP.innerHTML='<span style="font-size:13px;color:rgba(255,255,255,.3);">暂无预设</span>';
        cardPreset.appendChild(noP);
      }
      f.appendChild(cardPreset);

      /* ── Section: 数据管理 ── */
      f.appendChild(_div('v8sec','数据管理'));
      var cardData=_div('v8card');
      var clrRow=_div('v8row tap');clrRow.style.padding='12px 14px';
      clrRow.appendChild(_div('v8ic','<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.8" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>'));
      clrRow.appendChild(_div('v8rb','<div class="v8rt" style="color:rgba(255,255,255,.85)">清空所有功能系统缓存</div><div class="v8rs">删除所有角色的历史记录</div>'));
      clrRow.addEventListener('click',function(e){
        e.stopPropagation();
        if(!TOP.confirm('确定要清空所有缓存吗？'))return;
        _sbS.history={};_sbS.injectCharIds=[];_ui.histIdx={};
        _W();if(TOP._v8draw)TOP._v8draw();_toast('已清空所有缓存');
      });
      cardData.appendChild(clrRow);
      f.appendChild(cardData);

      return f;
    }





    // ══════════════════════════════════════════════════════
    // ── 功能系统 v8 – Plugin-based iOS UI ─────────────────
    // ══════════════════════════════════════════════════════

    /* ─── Plugin injection aggregator ──────────────────── */
    function _updatePluginInjection(){
      var apps=(_sbS.vnmApps||[]).filter(function(a){return a.enabled&&a.injectEnabled&&a.injectCode;});
      if(!apps.length){_sbInjectFn=function(){return'';};return;}
      _sbInjectFn=function(){
        var parts=[];
        apps.forEach(function(app){
          try{
            var ctx=_makePluginCtx(app);
            var fn=new TOP.Function('ctx','return('+app.injectCode+')(ctx);');
            var r=fn(ctx);if(r)parts.push(String(r));
          }catch(e){}
        });
        return parts.join('\n');
      };
    }

    /* ─── Plugin context factory ─────────────────────────── */
    function _makePluginCtx(app){
      var TDOC=TOPDOC;
      function _d2(tag,cls,html){var e=TDOC.createElement(tag);if(cls)e.className=cls;if(html)e.innerHTML=html;return e;}
      return{
        sbS:_sbS, settings:app.settingsValues||{}, save:_W, toast:_toast,
        div:function(cls,html){return _d2('div',cls,html);},
        el:function(tag,cls,html){return _d2(tag,cls,html);},
        fetch:TOP.fetch, Audio:TOP.Audio, atob:TOP.atob,
        SpeechRecognition:TOP.SpeechRecognition||TOP.webkitSpeechRecognition,
        getChars:function(){return _sbS.characters||[];},
        getActiveChars:function(){var ids=_sbS.activeCharIds||[];return(_sbS.characters||[]).filter(function(c){return ids.indexOf(c.id)>=0;});},
        getActivePreset:function(){return _ap?_ap():null;},
        getUser:function(){return _sbS.user||{name:'',persona:''};},
        getWbActive:function(){var ac=_sbS.wbActive||[];return(_sbS.wbEntries||[]).filter(function(e){return ac.indexOf(e.id)>=0;});},
        renderTemplate:function(tpl,ch){
          var c=ch||(((_sbS.activeCharIds||[]).length&&_sbS.characters||[]).find?(_sbS.characters||[]).find(function(x){return(_sbS.activeCharIds||[]).indexOf(x.id)>=0;}):null)||{name:'',persona:''};
          return(tpl||'')
            .replace(/\{\{角色名称\}\}/g,c.name||'')
            .replace(/\{\{角色设定\}\}/g,c.persona||'')
            .replace(/\{\{用户名称\}\}/g,(_sbS.user&&_sbS.user.name)||'用户')
            .replace(/\{\{用户设定\}\}/g,(_sbS.user&&_sbS.user.persona)||'')
            .replace(/\{\{当前时间\}\}/g,new Date().toLocaleString('zh-CN'));
        }
      };
    }

    /* ─── Main phone tab render ──────────────────────────── */
    function _renderPhoneTab(){

      /* CSS (once) */
      var _oldSt=TOPDOC.getElementById('vnm-v8-css');if(_oldSt)_oldSt.remove();if(true){
        var _s=TOPDOC.createElement('style');_s.id='vnm-v8-css';
        _s.textContent=
          '#vnm-v8{display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--g-bg,transparent);}'
          +'#vnm-v8-scr{flex:1;overflow:hidden;position:relative;min-height:0;}'
          +'.v8pg{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;background:transparent;}'
          +'@keyframes v8in{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes v8back{from{transform:translateX(0)}to{transform:translateX(100%)}}@keyframes v8fade{from{opacity:0}to{opacity:1}}'
          +'.v8sl{animation:v8in .22s cubic-bezier(.4,0,.2,1);}'
          /* nav */
          +''
          +'.v8nav-title{font-size:20px;font-weight:700;color:rgba(255,255,255,.92);flex:1;}'
          +'.v8back{font-size:13px;color:rgba(255,255,255,.5);cursor:pointer;display:flex;align-items:center;gap:2px;line-height:1;}'
          +'.v8back svg{flex-shrink:0;}'
          +'.v8back:hover{color:rgba(255,255,255,.85);}'
          /* section */
          +''
          /* card */
          +''
          /* row */
          +'.v8row{display:flex;align-items:center;padding:11px 14px;min-height:44px;border-bottom:.5px solid rgba(255,255,255,.055);}'
          +'.v8row:last-child{border-bottom:none;}'
          +'.v8row.tap{cursor:pointer;transition:background .12s;}'
          +'.v8row.tap:active{background:rgba(255,255,255,.07);transform:scale(0.985);transition:background .05s,transform .05s;}'
          +'.v8ic{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.10);backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));-webkit-backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));border:.5px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:11px;}'
          +'.v8ic svg{stroke:rgba(255,255,255,.72);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}'
          +'.v8rb{flex:1;min-width:0;}'
          +'.v8rt{font-size:15px;color:rgba(255,255,255,.88);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
          +'.v8rs{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px;}'
          +'.v8chev{color:rgba(255,255,255,.2);font-size:16px;margin-left:6px;flex-shrink:0;}'
          /* app grid */
          +'.v8grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:6px 14px 14px;}'
          +'.v8home{display:grid;grid-template-columns:repeat(4,1fr);gap:20px 8px;padding:8px 16px 18px;}'
          +'.v8hi{display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;}'
          +'.v8hi:active .v8hic{transform:scale(.9);}'
          +'.v8hic{position:relative;width:60px;height:60px;border-radius:19px;overflow:hidden;isolation:isolate;display:flex;align-items:center;justify-content:center;transition:transform .12s;z-index:0;box-shadow:inset 0 0 0 .5px rgba(255,255,255,calc(.45*var(--g-hl,1))),inset 0 1.5px 0 rgba(255,255,255,calc(.60*var(--g-hl,1))),inset 0 -1px 0 rgba(255,255,255,calc(.18*var(--g-hl,1))),0 8px 22px rgba(0,0,0,.28);}'
          +'.v8hic::before{content:"";position:absolute;inset:0;border-radius:19px;background:var(--ge-tint,rgba(255,255,255,0));backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%)) brightness(var(--g-bright,1));-webkit-backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%)) brightness(var(--g-bright,1));filter:var(--ge-filter,url(#vnm-lg-el));z-index:0;pointer-events:none;}'
          +'.v8hic>*{position:relative;z-index:2;}'
          +'.v8hic svg{stroke:rgba(255,255,255,.90);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35));}'
          +'.v8hl{font-size:11px;font-weight:500;color:rgba(255,255,255,.88);text-shadow:0 1px 4px rgba(0,0,0,.45);max-width:66px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;}'
          +'.v8app{position:relative;border-radius:var(--g-rad,20px);overflow:hidden;aspect-ratio:1.18/1;padding:14px 12px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:11px;cursor:pointer;background:transparent;border:none;z-index:0;isolation:isolate;box-shadow:inset 0 0 0 .5px rgba(255,255,255,calc(.40*var(--g-hl,1))),inset 0 1px 0 rgba(255,255,255,calc(.55*var(--g-hl,1))),0 4px 24px rgba(0,0,0,.20);}'+'.v8app::before{content:"";position:absolute;inset:0;border-radius:var(--g-rad,20px);background:var(--ge-tint,rgba(255,255,255,0));backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%)) brightness(var(--g-bright,1));-webkit-backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%)) brightness(var(--g-bright,1));filter:var(--ge-filter,url(#vnm-lg-el));z-index:0;pointer-events:none;}'+'.v8app::after{content:"";position:absolute;inset:0;padding:.8px;border-radius:var(--g-rad,20px);pointer-events:none;z-index:3;background:linear-gradient(135deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.35) 35%,rgba(255,255,255,.70) 65%,rgba(255,255,255,0) 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;mix-blend-mode:screen;opacity:var(--g-hl,1);}'+'.v8app>*{position:relative;z-index:1;}'+'.v8grid .v8ad{display:none;}'
          +'.v8app:active{background:rgba(255,255,255,.09);transform:scale(0.97);}'+'.v8app{transition:background .12s,transform .1s;}'+'.v8fi{width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(255,255,255,.07);border:.5px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(255,255,255,.88);font-size:14px;font-family:inherit;outline:none;-webkit-appearance:none;appearance:none;}.v8fi:focus{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.1);}.v8fi::placeholder{color:rgba(255,255,255,.22);}.v8tog{position:relative;width:42px;height:26px;flex-shrink:0;cursor:pointer;}.v8tog input{opacity:0;width:0;height:0;position:absolute;}.v8nav{display:flex;align-items:center;padding:14px 14px 8px;gap:8px;flex-shrink:0;border-bottom:.5px solid rgba(255,255,255,.06);margin-bottom:2px;}.v8sec{font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.25);padding:16px 14px 5px;}.v8card{position:relative;border-radius:var(--g-rad,20px);overflow:hidden;margin:0 14px 10px;background:transparent;border:none;z-index:0;isolation:isolate;box-shadow:inset 0 0 0 .5px rgba(255,255,255,calc(.40*var(--g-hl,1))),inset 0 1px 0 rgba(255,255,255,calc(.55*var(--g-hl,1))),0 4px 24px rgba(0,0,0,.20);}.v8card::before{content:"";position:absolute;inset:0;border-radius:var(--g-rad,20px);background:var(--ge-tint,rgba(255,255,255,0));backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%)) brightness(var(--g-bright,1));-webkit-backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%)) brightness(var(--g-bright,1));filter:var(--ge-filter,url(#vnm-lg-el));z-index:0;pointer-events:none;box-shadow:none;}.v8card::after{content:"";position:absolute;inset:0;padding:.8px;border-radius:var(--g-rad,20px);pointer-events:none;z-index:3;background:linear-gradient(var(--lg-rot,135deg),rgba(255,255,255,0) 0%,rgba(255,255,255,.35) 35%,rgba(255,255,255,.70) 65%,rgba(255,255,255,0) 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;mix-blend-mode:screen;opacity:var(--g-hl,1);}.v8card>*{position:relative;z-index:2;}'
          +'.v8app.off{opacity:.35;pointer-events:none;}'
          +'.v8aic{width:58px;height:58px;border-radius:17px;background:rgba(255,255,255,.10);border:.5px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.28);backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));-webkit-backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));display:flex;align-items:center;justify-content:center;}'
          +'.v8aic svg{stroke:rgba(255,255,255,.75);fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}'
          +'.v8an{font-size:14px;font-weight:600;color:rgba(255,255,255,.92);letter-spacing:.2px;}'
          +'.v8ad{font-size:11px;color:rgba(255,255,255,.35);line-height:1.4;}'
          /* button */
          +'.v8btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:12px;background:rgba(255,255,255,.14);backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));-webkit-backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));border:.5px solid rgba(255,255,255,.30);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.50),0 2px 8px rgba(0,0,0,.15);color:rgba(255,255,255,.92);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s,transform .1s;}'
          +'.v8btn:hover{background:rgba(255,255,255,.22);}' +'.v8btn:active{background:rgba(255,255,255,.26);transform:scale(.97);}'
          +'.v8btn svg{stroke:rgba(255,255,255,.65);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;}'
          +'.v8btn.del{color:rgba(255,255,255,.75);border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.06);}'
          +'.v8btn.del svg{stroke:rgba(255,255,255,.65);}'
          /* toggle */
          +'.v8tog{width:40px;height:23px;border-radius:12px;background:rgba(255,255,255,.16);backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));-webkit-backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));border:.5px solid rgba(255,255,255,.22);cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.30);}'
          +'.v8tog.on{background:rgba(255,255,255,.52);box-shadow:inset 0 1px 0 rgba(255,255,255,.70);}'
          +'.v8tog::after{content:"";position:absolute;top:2px;left:2px;width:19px;height:19px;background:#fff;border-radius:10px;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,.3);}'
          +'.v8tog.on::after{transform:translateX(17px);}'
          /* field input */
          +'.v8field{padding:7px 12px;border-bottom:.5px solid rgba(255,255,255,.055);}'
          +'.v8field:last-child{border-bottom:none;}'
          +'.v8flb{font-size:10px;color:rgba(255,255,255,.32);letter-spacing:.3px;margin-bottom:3px;}'
          +'.v8inp{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:.5px solid rgba(255,255,255,.1);border-radius:9px;color:rgba(255,255,255,.88);padding:7px 10px;font-size:13px;outline:none;font-family:inherit;}'
          +'.v8inp:focus{border-color:rgba(255,255,255,.32);}'
          +'.v8ta{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:.5px solid rgba(255,255,255,.1);border-radius:9px;color:rgba(255,255,255,.88);padding:7px 10px;font-size:12px;line-height:1.6;resize:none;outline:none;font-family:inherit;}'
          +'.v8ta:focus{border-color:rgba(255,255,255,.32);}'
          /* override for v9.25 content */
          +'#vnm-v8-scr input:not([type=range]),#vnm-v8-scr textarea,#vnm-v8-scr select{background:rgba(255,255,255,.07)!important;border:.5px solid rgba(255,255,255,.1)!important;color:rgba(255,255,255,.88)!important;border-radius:9px!important;outline:none!important;}'
          +'#vnm-v8-scr input:focus,#vnm-v8-scr textarea:focus,#vnm-v8-scr select:focus{border-color:rgba(255,255,255,.32)!important;}'
          +'#vnm-v8-scr button{background:rgba(255,255,255,.08)!important;border:.5px solid rgba(255,255,255,.13)!important;color:rgba(255,255,255,.82)!important;border-radius:9px!important;}'
          +'#vnm-v8-scr button:hover{background:rgba(255,255,255,.13)!important;}'
          +'#vnm-v8-scr input[type=range]{-webkit-appearance:none!important;appearance:none!important;background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;margin:0!important;accent-color:rgba(255,255,255,.9);}'
          +'#vnm-v8-scr input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:rgba(255,255,255,.20);box-shadow:inset 0 1px 1px rgba(0,0,0,.25);}'
          +'#vnm-v8-scr input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;margin-top:-7px;border:none;box-shadow:0 1px 5px rgba(0,0,0,.45),inset 0 -1px 1px rgba(0,0,0,.08);cursor:pointer;}'
          +'#vnm-v8-scr input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:rgba(255,255,255,.20);}'
          +'#vnm-v8-scr input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:#fff;border:none;box-shadow:0 1px 5px rgba(0,0,0,.45);cursor:pointer;}';
        TOPDOC.head.appendChild(_s);
      }
      /* Liquid Glass SVG Filter (once) */
      var _lgOld=TOPDOC.getElementById('vnm-lg-svg');
      if(_lgOld&&_lgOld.innerHTML.indexOf('vnm-lg-bg')===-1){try{_lgOld.parentNode.removeChild(_lgOld);}catch(e){}_lgOld=null;}
      if(!_lgOld){
        var _lgEl=TOPDOC.createElement('div');
        _lgEl.id='vnm-lg-svg';
        _lgEl.style.cssText='position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0;top:0;left:0;';
        _lgEl.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;" aria-hidden="true"><defs><filter id="vnm-lg-bg" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Cdefs%3E%3CradialGradient%20id%3D%22g%22%20cx%3D%2250%25%22%20cy%3D%2250%25%22%20r%3D%2272%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22black%22/%3E%3Cstop%20offset%3D%2295%25%22%20stop-color%3D%22black%22/%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22white%22/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22url%28%23g%29%22/%3E%3C/svg%3E" preserveAspectRatio="none" result="mask"/><feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="7" result="noise"/><feGaussianBlur in="noise" stdDeviation="2" result="soft"/><feComposite in="soft" in2="mask" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="nm"/><feFlood flood-color="rgb(128,128,128)" result="gray"/><feComposite in="gray" in2="mask" operator="arithmetic" k1="-1" k2="1" k3="0" k4="0" result="gm"/><feComposite in="nm" in2="gm" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="dmap"/><feDisplacementMap in="SourceGraphic" in2="dmap" scale="60" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="vnm-lg-el" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Cdefs%3E%3CradialGradient%20id%3D%22g%22%20cx%3D%2250%25%22%20cy%3D%2250%25%22%20r%3D%2272%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22black%22/%3E%3Cstop%20offset%3D%2295%25%22%20stop-color%3D%22black%22/%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22white%22/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22url%28%23g%29%22/%3E%3C/svg%3E" preserveAspectRatio="none" result="mask"/><feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="7" result="noise"/><feGaussianBlur in="noise" stdDeviation="2" result="soft"/><feComposite in="soft" in2="mask" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="nm"/><feFlood flood-color="rgb(128,128,128)" result="gray"/><feComposite in="gray" in2="mask" operator="arithmetic" k1="-1" k2="1" k3="0" k4="0" result="gm"/><feComposite in="nm" in2="gm" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="dmap"/><feDisplacementMap in="SourceGraphic" in2="dmap" scale="60" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>';
        TOPDOC.body.appendChild(_lgEl);
      }


      /* Shell */
      var shell=TOPDOC.createElement('div');shell.id='vnm-v8';_applyGlass(shell);
      var scr=TOPDOC.createElement('div');scr.id='vnm-v8-scr';shell.appendChild(scr);TOP._v8scr=scr;
      /* Liquid Glass 鼠标追踪 — 驱动 --lg-rot 变量 */
      scr.addEventListener('mousemove',function(e){
        var r=scr.getBoundingClientRect();
        var ox=(e.clientX-r.left-r.width/2)/(r.width/2);
        scr.style.setProperty('--lg-rot',(135+ox*60)+'deg');
      });
      scr.addEventListener('mouseleave',function(){
        scr.style.setProperty('--lg-rot','135deg');
      });

      /* Nav state */
      if(!TOP._v8nav)TOP._v8nav={page:'home',data:{}};
      var _nav=TOP._v8nav;

      /* iOS home bar */
      var _homeBar=TOPDOC.createElement('div');
      _homeBar.className='vnm-homebar';
      _homeBar.style.cssText='flex-shrink:0;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;overflow:hidden;background:transparent;border-top:.5px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.12);';
      var _homeBarGlass=TOPDOC.createElement('div');
      _homeBarGlass.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:0;background:var(--ge-tint,rgba(255,255,255,0));backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));-webkit-backdrop-filter:blur(var(--ge-blur,0px)) saturate(var(--ge-sat,160%));filter:var(--ge-filter,url(#vnm-lg-el));';
      _homeBar.appendChild(_homeBarGlass);
      var _homeBarPill=TOPDOC.createElement('div');
      _homeBarPill.className='vnm-homebar-pill';
      _homeBarPill.style.cssText='position:relative;z-index:1;width:130px;height:5px;background:rgba(255,255,255,0.28);border-radius:3px;transition:background .15s;';
      _homeBar.appendChild(_homeBarPill);
      shell.appendChild(_homeBar);
      /* Floating close button */
      var _floatClose=TOPDOC.createElement('button');
      _floatClose.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      _floatClose.style.cssText='position:absolute;top:10px;right:10px;z-index:100;width:28px;height:28px;border-radius:50%;border:none;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:background .15s;';
      _floatClose.addEventListener('mouseenter',function(){this.style.background='rgba(255,255,255,.2)';});
      _floatClose.addEventListener('mouseleave',function(){this.style.background='rgba(255,255,255,.1)';});
      _floatClose.addEventListener('click',function(e){e.stopPropagation();_sb.style.display='none';_sbS.visible=false;_W();var tb=overlay.querySelector('#vnm-btn-sb-toggle');if(tb){tb.style.color='rgba(255,255,255,.38)';tb.style.background='transparent';tb.style.borderColor='transparent';}});
      shell.style.position='relative';
      shell.appendChild(_floatClose);
      var _lastTap=0;
      _homeBar.addEventListener('click',function(){
        var now=Date.now();
        if(now-_lastTap<320){
          /* double tap → home */
          _homeBarPill.style.background='rgba(255,255,255,0.6)';
          TOP.setTimeout(function(){_homeBarPill.style.background='rgba(255,255,255,0.28)';},300);
          _nav.page='home';_nav.data={};_render();
        } else {
          /* single tap → back (pop one level) */
          var _backMap={'s-api':'settings','s-chars':'settings','s-presets':'settings',
            's-wb':'settings','s-tts':'settings','s-vc':'settings',
            's-plugin':'settings','s-apps':'settings','s-glass':'settings',
            'settings':'home','app-run':'home',
            'phone-contacts':'home','call':'phone-contacts',
            'phone-recents':'home','phone-recents-detail':'phone-recents'};
          var dest=_backMap[_nav.page]||'home';
          _nav.page=dest;_nav.data={};_render();
        }
        _lastTap=now;
      });
      _homeBar.addEventListener('mouseenter',function(){_homeBarPill.style.background='rgba(255,255,255,0.45)';});
      _homeBar.addEventListener('mouseleave',function(){_homeBarPill.style.background='rgba(255,255,255,0.28)';});


      /* Helpers */
      function _el(tag,cls,html){var e=TOPDOC.createElement(tag);if(cls)e.className=cls;if(html)e.innerHTML=html;return e;}
      function _div(cls,html){return _el('div',cls,html);}
      function _svg(d,sz){sz=sz||18;return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24">'+d+'</svg>';}
      function _go(page,data){
        var _s=TOP._v8scr||scr;
        var oldEl=_s.lastElementChild;
        _nav.page=page;_nav.data=data||{};
        try{(_pages[page]||_pgHome)();}catch(e){console.error('[VNM v8]',page,e);return;}
        var newEl=_s.lastElementChild;
        if(!oldEl||oldEl===newEl){return;}
        /* Slide new page in from right, slide old out to left */
        newEl.classList.remove('v8sl');
        newEl.style.cssText+='transform:translateX(100%);transition:none;will-change:transform;';
        requestAnimationFrame(function(){requestAnimationFrame(function(){
          newEl.style.transition='transform .24s cubic-bezier(.4,0,.2,1)';
          oldEl.style.transition='transform .24s cubic-bezier(.4,0,.2,1),opacity .2s';
          newEl.style.transform='translateX(0)';
          oldEl.style.transform='translateX(-30%)';
          oldEl.style.opacity='0';
          TOP.setTimeout(function(){
            if(oldEl.parentNode)oldEl.parentNode.removeChild(oldEl);
            newEl.style.transition='';newEl.style.willChange='';
          },260);
        });});
      }
      TOP._v8go=_go;
      function _navbar(title,backPage){
        var nb=_div('v8nav');
        /* Live clock element */
        var clkEl=TOPDOC.createElement('span');
        clkEl.style.cssText='font-size:17px;font-weight:700;color:rgba(255,255,255,.92);letter-spacing:.4px;font-variant-numeric:tabular-nums;cursor:'+(backPage?'pointer':'default')+';user-select:none;flex-shrink:0;';
        function _uc(){var n=new Date();clkEl.textContent=(n.getHours()<10?'0':'')+n.getHours()+':'+(n.getMinutes()<10?'0':'')+n.getMinutes();}
        _uc();
        var _ci=setInterval(_uc,1000);
        /* Clean up interval when el detaches */
        var _mo=new TOP.MutationObserver(function(){if(!TOPDOC.body.contains(clkEl)){clearInterval(_ci);_mo.disconnect();}});
        _mo.observe(TOPDOC.body,{childList:true,subtree:true});
        if(backPage){clkEl.addEventListener('click',function(){_go(backPage);});}
        nb.appendChild(clkEl);
        return nb;
      }
      function _tog(val,cb){
        var t=_div('v8tog'+(val?' on':''));
        t.addEventListener('click',function(e){e.stopPropagation();val=!val;t.className='v8tog'+(val?' on':'');cb(val);});
        return t;
      }
      /* Wrap a v9.25 fragment in a scrollable page with auto re-render on interaction */
      function _wrapLegacy(title,backPage,renderFn){
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar(title,backPage));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 20px;';
        var wrap=_div('');
        var _busy=false;
        function _draw(){
          if(_busy)return;_busy=true;
          try{var f=renderFn();while(wrap.firstChild)wrap.removeChild(wrap.firstChild);if(f){f.childNodes&&f.childNodes[0]&&(f.childNodes[0].style||(f.childNodes[0].style={}));wrap.appendChild(f);if(wrap.firstChild&&wrap.firstChild.style)wrap.firstChild.style.animation='v8fade .18s ease';}}catch(e){wrap.innerHTML='<div style="padding:16px;font-size:12px;color:rgba(255,255,255,.65)">渲染错误: '+e.message+'</div>';}
          _busy=false;
        }
        TOP._v8draw=_draw;
        _draw();
        /* Re-render after any click/change so toggles update visually */
        body.addEventListener('click',function(){TOP.setTimeout(_draw,80);});
        body.addEventListener('change',function(){TOP.setTimeout(_draw,60);});
        body.appendChild(wrap);pg.appendChild(body);scr.appendChild(pg);
      }
      /* Settings field row */
      function _fieldRow(field,values){
        var r=_div('v8field');
        r.appendChild(_div('v8flb',field.label));
        if(field.type==='toggle'){
          var row=_div('');row.style.cssText='display:flex;align-items:center;justify-content:space-between;';
          row.appendChild(_div('','<span style="font-size:14px;color:rgba(255,255,255,.82);">'+field.label+'</span>'));
          var tv=!!(values[field.key]!==undefined?values[field.key]:field.default);
          row.appendChild(_tog(tv,function(v){values[field.key]=v;_W();}));
          r.innerHTML='';r.appendChild(row);
        } else if(field.type==='select'){
          var sel=TOPDOC.createElement('select');sel.className='v8inp';
          (field.options||[]).forEach(function(o){
            var opt=TOPDOC.createElement('option');opt.value=o.v||o.value;opt.textContent=o.l||o.label;
            if(opt.value===(values[field.key]||field.default))opt.selected=true;
            sel.appendChild(opt);
          });
          sel.addEventListener('mousedown',function(e){e.stopPropagation();});
          sel.addEventListener('change',function(){values[field.key]=this.value;_W();});
          r.appendChild(sel);
        } else if(field.type==='textarea'){
          var ta=TOPDOC.createElement('textarea');ta.className='v8ta';
          ta.rows=field.rows||4;ta.value=values[field.key]||field.default||'';
          if(field.placeholder)ta.placeholder=field.placeholder;
          ta.addEventListener('mousedown',function(e){e.stopPropagation();});
          ta.addEventListener('input',function(){values[field.key]=this.value;_W();});
          r.appendChild(ta);
        } else if(field.type==='textarea-presets'){
          /* ── variable insertion buttons ── */
          if(field.variables&&field.variables.length){
            var vWrap=TOPDOC.createElement('div');
            vWrap.style.cssText='display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px;';
            (function(vWrap){
              field.variables.forEach(function(vv){
                (function(vv){
                  var vb=TOPDOC.createElement('button');
                  vb.textContent=vv;
                  vb.style.cssText='padding:2px 8px;border-radius:10px;background:rgba(255,255,255,.09);border:.5px solid rgba(255,255,255,.14);color:rgba(255,255,255,.70);font-size:11px;cursor:pointer;font-family:inherit;line-height:1.6;';
                  vb.addEventListener('click',function(e){
                    e.stopPropagation();
                    var pos=ta2.selectionStart||ta2.value.length;
                    ta2.value=ta2.value.slice(0,pos)+vv+ta2.value.slice(pos);
                    ta2.selectionStart=ta2.selectionEnd=pos+vv.length;
                    values[field.key]=ta2.value;_W();ta2.focus();
                  });
                  vWrap.appendChild(vb);
                })(vv);
              });
            })(vWrap);
            r.appendChild(vWrap);
          }
          /* ── textarea ── */
          var ta2=TOPDOC.createElement('textarea');ta2.className='v8ta';
          ta2.rows=field.rows||5;
          ta2.value=values[field.key]!==undefined?values[field.key]:(field.default||'');
          if(field.placeholder)ta2.placeholder=field.placeholder;
          ta2.addEventListener('mousedown',function(e){e.stopPropagation();});
          ta2.addEventListener('input',function(){values[field.key]=this.value;_W();});
          r.appendChild(ta2);
          /* ── preset controls ── */
          (function(ta2){
            var _pk='__p_'+field.key;
            var _getP=function(){return values[_pk]||[];};
            var pRow=TOPDOC.createElement('div');
            pRow.style.cssText='display:flex;gap:5px;margin-top:6px;align-items:center;flex-wrap:wrap;';
            var pSel=TOPDOC.createElement('select');pSel.className='v8inp';
            pSel.style.cssText='flex:1;min-width:80px;font-size:11px;padding:3px 6px;';
            var _fillSel=function(){
              pSel.innerHTML='';
              var dflt=TOPDOC.createElement('option');dflt.value='';dflt.textContent='— 选择预设 —';pSel.appendChild(dflt);
              _getP().forEach(function(p,i){var o=TOPDOC.createElement('option');o.value=String(i);o.textContent=p.name;pSel.appendChild(o);});
            };
            _fillSel();
            pSel.addEventListener('mousedown',function(e){e.stopPropagation();});
            var _pbtn=function(txt){
              var b=TOPDOC.createElement('button');b.textContent=txt;
              b.style.cssText='padding:3px 10px;border-radius:10px;background:rgba(255,255,255,.09);border:.5px solid rgba(255,255,255,.13);color:rgba(255,255,255,.68);font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;';
              b.addEventListener('mouseenter',function(){b.style.background='rgba(255,255,255,.15)';});
              b.addEventListener('mouseleave',function(){b.style.background='rgba(255,255,255,.09)';});
              return b;
            };
            var bApply=_pbtn('应用');
            bApply.addEventListener('click',function(e){
              e.stopPropagation();
              var idx=parseInt(pSel.value);if(isNaN(idx))return;
              var p=_getP()[idx];if(!p)return;
              ta2.value=p.content;values[field.key]=ta2.value;_W();
            });
            var bSave=_pbtn('保存预设');
            bSave.addEventListener('click',function(e){
              e.stopPropagation();
              var nm=TOP.prompt('预设名称：');if(!nm||!nm.trim())return;
              var ps=_getP();ps.push({name:nm.trim(),content:ta2.value});
              values[_pk]=ps;_W();_fillSel();pSel.value=String(ps.length-1);
            });
            var bDel=_pbtn('删除');
            bDel.style.color='rgba(255,255,255,.42)';
            bDel.addEventListener('click',function(e){
              e.stopPropagation();
              var idx=parseInt(pSel.value);if(isNaN(idx))return;
              var ps=_getP();ps.splice(idx,1);values[_pk]=ps;_W();_fillSel();
            });
            pRow.appendChild(pSel);pRow.appendChild(bApply);pRow.appendChild(bSave);pRow.appendChild(bDel);
            r.appendChild(pRow);
          })(ta2);
        } else {
          var inp=TOPDOC.createElement('input');inp.className='v8inp';
          inp.type=field.type==='password'?'password':(field.type==='number'?'number':'text');
          inp.value=values[field.key]!==undefined?values[field.key]:(field.default||'');
          if(field.placeholder)inp.placeholder=field.placeholder;
          if(field.min!==undefined)inp.min=field.min;if(field.max!==undefined)inp.max=field.max;
          inp.addEventListener('mousedown',function(e){e.stopPropagation();});
          inp.addEventListener('change',function(){values[field.key]=(inp.type==='number'?parseFloat(this.value):this.value);_W();});
          r.appendChild(inp);
        }
        return r;
      }

      /* ════════════════════════════════════════════════════
         HOME SCREEN
      ════════════════════════════════════════════════════ */
      function _pgHome(){
        var pg=_div('v8pg v8sl');
        var hdr=_div('');hdr.style.cssText='padding:26px 20px 18px;flex-shrink:0;';
        hdr.innerHTML='<div style="font-size:10px;font-weight:600;letter-spacing:3px;color:rgba(255,255,255,.35);text-transform:uppercase;margin-bottom:10px;">功能系统</div>'
          +'<div id="v8clk" style="font-size:58px;font-weight:200;line-height:1;color:rgba(255,255,255,.96);letter-spacing:1px;font-variant-numeric:tabular-nums;text-shadow:0 2px 12px rgba(0,0,0,.35);"></div>'
          +'<div id="v8date" style="font-size:13px;font-weight:500;color:rgba(255,255,255,.45);letter-spacing:1px;margin-top:8px;"></div>';
        pg.appendChild(hdr);
        (function(){
          var ck=hdr.querySelector('#v8clk'),dt=hdr.querySelector('#v8date');
          function _u(){var n=new Date();ck.textContent=(n.getHours()<10?'0':'')+n.getHours()+':'+(n.getMinutes()<10?'0':'')+n.getMinutes();
            dt.textContent=(n.getMonth()+1)+'月'+n.getDate()+'日 '+['周日','周一','周二','周三','周四','周五','周六'][n.getDay()];}
          _u();var _t=TOP.setInterval(function(){if(!TOPDOC.body.contains(ck)){TOP.clearInterval(_t);return;}_u();},1000);
        })();
        /* iOS springboard icon grid */
        var grid=_div('v8home');
        function _appCard(name,desc,svgD,onclick,extra){
          var c=_div('v8hi'+(extra?' '+extra:''));
          c.appendChild(_div('v8hic',_svg(svgD,26)));
          c.appendChild(_div('v8hl',name));
          if(onclick)c.addEventListener('click',onclick);
          return c;
        }
        grid.appendChild(_appCard('设置','功能配置 · API · 角色',
          '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>',
          function(){_go('settings');}));
        /* Built-in: 通讯录 */
        grid.appendChild(_appCard('通讯录','联系人 · 角色 · 用户',
          '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
          function(){_go('contacts');}));
        /* Plugin apps */
        (_sbS.vnmApps||[]).filter(function(a){return a.enabled;}).forEach(function(app){
          var c=_div('v8hi');
          var ic=_div('v8hic');ic.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" style="stroke:rgba(255,255,255,.88);fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;position:relative;z-index:2;">'+app.icon+'</svg>';
          c.appendChild(ic);c.appendChild(_div('v8hl',app.name));
          c.addEventListener('click',function(){_go('app-run',{app:app});});
          grid.appendChild(c);
        });
        /* 应用商城 card – same style as Settings, triggers file import */
        var fileInput=TOPDOC.createElement('input');fileInput.type='file';fileInput.accept='.json';fileInput.style.display='none';
        fileInput.addEventListener('change',function(){
          var f=this.files&&this.files[0];if(!f)return;
          var reader=new TOP.FileReader();
          reader.onload=function(e){
            try{
              var p=JSON.parse(e.target.result);
              if(!p.vnmPlugin)throw new Error('不是有效的 VNM Plugin 文件');
              if(!p.id||!p.name)throw new Error('缺少 id 或 name 字段');
              var apps=_sbS.vnmApps||[];
              var idx=apps.findIndex?apps.findIndex(function(a){return a.id===p.id;}):
                (function(){for(var i=0;i<apps.length;i++)if(apps[i].id===p.id)return i;return -1;})();
              var entry={id:p.id,name:p.name,version:p.version||'1.0',description:p.description||'',
                icon:p.icon||'<circle cx="12" cy="12" r="5"/>',enabled:true,
                settingsTitle:p.settingsTitle||p.name,settingsFields:p.settingsFields||[],
                settingsValues:idx>=0?apps[idx].settingsValues:{},
                pageCode:p.pageCode||'',injectCode:p.injectCode||'',injectEnabled:!!(p.injectEnabled)};
              (p.settingsFields||[]).forEach(function(f){if(entry.settingsValues[f.key]===undefined&&f.default!==undefined)entry.settingsValues[f.key]=f.default;});
              if(idx>=0)apps[idx]=entry;else apps.push(entry);
              _sbS.vnmApps=apps;_W();_updatePluginInjection();_render();
              _toast('已导入: '+p.name);
            }catch(err){_toast('导入失败: '+err.message);}
          };reader.readAsText(f);
        });
        grid.appendChild(_appCard('应用商城','导入 · 管理插件 App',
          '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>',
          function(){fileInput.click();}));
        pg.appendChild(fileInput);
        pg.appendChild(grid);scr.appendChild(pg);
      }


      /* ════════════════════════════════════════════════════
         通讯录 – iOS Contacts Style
      ════════════════════════════════════════════════════ */
      /* Avatar helper: colored circle with initial or image */
      function _mkAvatar(name,avatarUrl,size){
        size=size||44;
        var av=TOPDOC.createElement('div');
        av.style.cssText='width:'+size+'px;height:'+size+'px;border-radius:50%;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:'+(size*0.38)+'px;color:#fff;';
        if(avatarUrl){
          av.style.backgroundImage='url('+avatarUrl+')';
          av.style.backgroundSize='cover';av.style.backgroundPosition='center';
          av.style.background='rgba(255,255,255,.08)';
        } else {
          /* iOS 顺色头像：扁平毛玻璃，无凸起感 */
          av.style.background='linear-gradient(145deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.07) 100%)';
          av.style.backdropFilter='blur(16px)';
          av.style.webkitBackdropFilter='blur(16px)';
          av.style.color='rgba(255,255,255,0.82)';
          av.style.letterSpacing='-0.5px';
          av.textContent=(name||'?').charAt(0).toUpperCase();
        }
        return av;
      }

      function _pgContacts(){
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar('通讯录','home'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 24px;';

        /* ── 我的信息 (User) ── */
        body.appendChild(_div('v8sec','我的信息'));
        var uCard=_div('v8card');
        var uRow=_div('v8row tap');uRow.style.padding='10px 14px';uRow.style.gap='12px';
        var uName=(_sbS.user&&_sbS.user.name)||'未设置';
        uRow.appendChild(_mkAvatar(uName,_sbS.user&&_sbS.user.avatar,40));
        var uRb=_div('v8rb');uRb.innerHTML='<div class="v8rt">'+uName+'</div><div class="v8rs">我的名片</div>';
        uRow.appendChild(uRb);uRow.appendChild(_div('v8chev','›'));
        uRow.addEventListener('click',function(){_go('contact-detail',{isUser:true});});
        uCard.appendChild(uRow);body.appendChild(uCard);

        /* ── 角色列表 ── */
        var chars=_sbS.characters||[];
        if(chars.length){
          body.appendChild(_div('v8sec','联系人'));
          var cCard=_div('v8card');
          chars.forEach(function(ch,ci){
            if(ci>0){var sep=_div('');sep.style.cssText='height:.5px;background:rgba(255,255,255,.055);margin:0 14px;';cCard.appendChild(sep);}
            var row=_div('v8row tap');row.style.padding='10px 14px';row.style.gap='12px';
            row.appendChild(_mkAvatar(ch.name,ch.avatar,40));
            var rb=_div('v8rb');rb.innerHTML='<div class="v8rt">'+(ch.name||'未命名')+'</div>'+(ch.ttsEnabled?'<div class="v8rs">TTS 已启用</div>':'');
            row.appendChild(rb);row.appendChild(_div('v8chev','›'));
            row.addEventListener('click',(function(id){return function(){_go('contact-detail',{isUser:false,charId:id});};})(ch.id));
            cCard.appendChild(row);
          });
          body.appendChild(cCard);
        } else {
          body.appendChild(_div('v8sec','联系人'));
          var emptyCard=_div('v8card');
          var emptyRow=_div('v8row');emptyRow.style.padding='16px 14px';emptyRow.style.cursor='default';
          emptyRow.innerHTML='<span style="font-size:13px;color:rgba(255,255,255,.28);text-align:center;width:100%;">暂无角色 · 在设置中添加</span>';
          emptyCard.appendChild(emptyRow);body.appendChild(emptyCard);
        }

        /* ── 新增角色按钮 ── */
        body.appendChild(_div('v8sec',''));
        var addCard=_div('v8card');
        var addRow=_div('v8row tap');addRow.style.padding='12px 14px';
        addRow.appendChild(_div('v8ic',_svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')));
        addRow.appendChild(_div('v8rb','<div class="v8rt">新建联系人</div>'));
        addRow.addEventListener('click',function(){
          var nm=TOP.prompt('角色名称：');if(!nm)return;
          if(!_sbS.characters)_sbS.characters=[];
          var nc={id:_uuid(),name:nm,persona:'',avatar:'',ttsEnabled:false,ttsVoiceId:'',ttsLanguage:'zh-CN',ttsSpeed:1.0};
          _sbS.characters.push(nc);_W();
          if(TOP._v8render)TOP._v8render();
          _go('contact-detail',{isUser:false,charId:nc.id});
        });
        addCard.appendChild(addRow);body.appendChild(addCard);

        pg.appendChild(body);scr.appendChild(pg);
      }

      function _pgContactDetail(){
        var isUser=_nav.data&&_nav.data.isUser;
        var charId=_nav.data&&_nav.data.charId;
        var char=null;
        if(!isUser){
          char=(_sbS.characters||[]).filter(function(c){return c.id===charId;})[0];
          if(!char){_go('contacts');return;}
        }
        var title=isUser?'我的信息':(char.name||'联系人');
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar(title,'contacts'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 32px;';

        /* ── Avatar header ── */
        var avHdr=_div('');avHdr.style.cssText='display:flex;flex-direction:column;align-items:center;padding:20px 0 16px;gap:10px;';
        var curName=isUser?((_sbS.user&&_sbS.user.name)||'用户'):(char.name||'?');
        var curAv=isUser?(_sbS.user&&_sbS.user.avatar):(char.avatar);
        var bigAv=_mkAvatar(curName,curAv,72);bigAv.style.cursor='pointer';
        bigAv.title='点击更换头像';
        var avFile=TOPDOC.createElement('input');avFile.type='file';avFile.accept='image/*';avFile.style.display='none';
        avFile.addEventListener('change',function(){
          var f=this.files&&this.files[0];if(!f)return;
          var r=new TOP.FileReader();
          r.onload=function(e){
            if(isUser){if(!_sbS.user)_sbS.user={};_sbS.user.avatar=e.target.result;}
            else{char.avatar=e.target.result;}
            _W();_go('contact-detail',_nav.data);
          };r.readAsDataURL(f);
        });
        bigAv.addEventListener('click',function(e){e.stopPropagation();avFile.click();});
        var avHint=_div('');avHint.style.cssText='font-size:11px;color:rgba(255,255,255,.28);';avHint.textContent='点击头像更换图片';
        avHdr.appendChild(bigAv);avHdr.appendChild(avHint);avHdr.appendChild(avFile);
        body.appendChild(avHdr);

        /* ── Info fields ── */
        body.appendChild(_div('v8sec','基本信息'));
        var infoCard=_div('v8card');

        function _fieldRow2(label,valGet,valSet,type){
          var row=_div('v8row');row.style.flexDirection='column';row.style.alignItems='stretch';row.style.padding='12px 14px';row.style.gap='5px';row.style.cursor='default';
          var lbl=_div('');lbl.style.cssText='font-size:11px;color:rgba(255,255,255,.35);font-weight:500;';lbl.textContent=label;
          if(type==='textarea'){
            var ta=TOPDOC.createElement('textarea');ta.className='v8fi';ta.rows=4;ta.value=valGet()||'';ta.placeholder='点击输入…';
            ta.style.resize='none';ta.style.lineHeight='1.5';
            ta.addEventListener('mousedown',function(e){e.stopPropagation();});
            ta.addEventListener('change',function(){valSet(this.value);_W();});
            row.appendChild(lbl);row.appendChild(ta);
          } else {
            var inp=TOPDOC.createElement('input');inp.className='v8fi';inp.type=type||'text';inp.value=valGet()||'';inp.placeholder='点击输入…';
            inp.addEventListener('mousedown',function(e){e.stopPropagation();});
            inp.addEventListener('change',function(){valSet(this.value.trim());_W();});
            row.appendChild(lbl);row.appendChild(inp);
          }
          return row;
        }

        if(isUser){
          if(!_sbS.user)_sbS.user={name:'',persona:''};
          infoCard.appendChild(_fieldRow2('名字',function(){return _sbS.user.name;},function(v){_sbS.user.name=v;}));
          var sep0=_div('');sep0.style.cssText='height:.5px;background:rgba(255,255,255,.055);margin:0 14px;';infoCard.appendChild(sep0);
          infoCard.appendChild(_fieldRow2('用户人设',function(){return _sbS.user.persona;},function(v){_sbS.user.persona=v;},'textarea'));
        } else {
          infoCard.appendChild(_fieldRow2('角色名字',function(){return char.name;},function(v){char.name=v;}));
          var sep1=_div('');sep1.style.cssText='height:.5px;background:rgba(255,255,255,.055);margin:0 14px;';infoCard.appendChild(sep1);
          infoCard.appendChild(_fieldRow2('角色人设',function(){return char.persona;},function(v){char.persona=v;},'textarea'));
        }
        body.appendChild(infoCard);

        /* ── ST 拉取 ── */
        body.appendChild(_div('v8sec','数据同步'));
        var syncCard=_div('v8card');
        var pullRow=_div('v8row tap');pullRow.style.padding='12px 14px';
        pullRow.appendChild(_div('v8ic',_svg('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>')));
        pullRow.appendChild(_div('v8rb','<div class="v8rt">'+(isUser?'从酒馆拉取用户信息':'从酒馆拉取角色信息')+'</div><div class="v8rs">覆盖当前名字和人设</div>'));
        pullRow.addEventListener('click',function(e){
          e.stopPropagation();
          if(isUser){
            _pullSTUser(function(){_go('contact-detail',_nav.data);_toast('✓ 用户信息已更新');});
          } else {
            _pullSTChar(char,function(){_go('contact-detail',_nav.data);_toast('✓ 角色信息已更新');});
          }
        });
        syncCard.appendChild(pullRow);body.appendChild(syncCard);

        /* ── TTS (角色only) ── */
        if(!isUser){
          body.appendChild(_div('v8sec','语音合成 TTS'));
          var ttsCard=_div('v8card');
          var ttsTogRow=_div('v8row');ttsTogRow.style.padding='12px 14px';ttsTogRow.style.cursor='default';
          ttsTogRow.appendChild(_div('v8rb','<div class="v8rt">启用 TTS</div>'));
          ttsTogRow.appendChild(_tog(char.ttsEnabled,function(v){char.ttsEnabled=v;_W();if(TOP._v8render)TOP._v8render();}));
          ttsCard.appendChild(ttsTogRow);
          if(char.ttsEnabled){
            /* MiniMax 预置音色 */
            var MM_VOICES=[
              {v:'female-shaonv',       l:'少女 female-shaonv'},
              {v:'female-yujie',        l:'御姐 female-yujie'},
              {v:'female-chengshu',     l:'成熟女声 female-chengshu'},
              {v:'female-tianmei',      l:'甜美 female-tianmei'},
              {v:'male-qn-qingse',      l:'青涩青年 male-qn-qingse'},
              {v:'male-qn-jingying',    l:'精英青年 male-qn-jingying'},
              {v:'male-qn-badao',       l:'霸道青年 male-qn-badao'},
              {v:'male-qn-daxuesheng',  l:'大学生 male-qn-daxuesheng'},
              {v:'presenter_male',      l:'男主播 presenter_male'},
              {v:'presenter_female',    l:'女主播 presenter_female'},
              {v:'audiobook_male_1',    l:'有声书男1 audiobook_male_1'},
              {v:'audiobook_male_2',    l:'有声书男2 audiobook_male_2'},
              {v:'audiobook_female_1',  l:'有声书女1 audiobook_female_1'},
              {v:'audiobook_female_2',  l:'有声书女2 audiobook_female_2'},
              {v:'clever_boy',          l:'聪明男孩 clever_boy'},
              {v:'cute_boy',            l:'可爱男孩 cute_boy'},
              {v:'lovely_girl',         l:'可爱女孩 lovely_girl'},
              {v:'cartoon_pig',         l:'卡通小猪 cartoon_pig'},
              {v:'bingjiao_didi',       l:'病娇弟弟 bingjiao_didi'},
              {v:'sweet_girl',          l:'甜美女声2 sweet_girl'},
              {v:'male-qn-qingse-jingpin',   l:'青涩青年·精品'},
              {v:'male-qn-jingying-jingpin', l:'精英青年·精品'},
              {v:'female-shaonv-jingpin',    l:'少女·精品'},
              {v:'female-yujie-jingpin',     l:'御姐·精品'},
              {v:'custom',              l:'自定义 Voice ID…'}
            ];
            /* ── Voice ID 行 ── */
            var _sep1=_div('');_sep1.style.cssText='height:.5px;background:rgba(255,255,255,.055);margin:0 14px;';ttsCard.appendChild(_sep1);
            var vidRow=_div('v8row');vidRow.style.flexDirection='column';vidRow.style.alignItems='stretch';vidRow.style.padding='12px 14px';vidRow.style.gap='6px';vidRow.style.cursor='default';
            vidRow.appendChild(_div('','<span style="font-size:11px;color:rgba(255,255,255,.35);font-weight:500;">音色 Voice ID</span>'));
            var vidSel=TOPDOC.createElement('select');
            vidSel.className='v8fi';vidSel.style.fontSize='13px';
            var curVid=char.ttsVoiceId||'female-shaonv';
            var hasCustom=!MM_VOICES.slice(0,-1).some(function(o){return o.v===curVid;});
            MM_VOICES.forEach(function(o){
              var opt=TOPDOC.createElement('option');opt.value=o.v;opt.textContent=o.l;
              if((hasCustom&&o.v==='custom')||(!hasCustom&&o.v===curVid))opt.selected=true;
              vidSel.appendChild(opt);
            });
            /* 自定义输入框（仅 custom 时显示） */
            var customInp=TOPDOC.createElement('input');customInp.className='v8fi';customInp.type='text';
            customInp.placeholder='输入自定义 Voice ID';
            customInp.value=hasCustom?curVid:'';
            customInp.style.display=hasCustom?'block':'none';
            customInp.addEventListener('mousedown',function(e){e.stopPropagation();});
            customInp.addEventListener('change',function(){char.ttsVoiceId=this.value.trim();_W();});
            vidSel.addEventListener('mousedown',function(e){e.stopPropagation();});
            vidSel.addEventListener('change',function(){
              if(this.value==='custom'){customInp.style.display='block';customInp.focus();}
              else{customInp.style.display='none';char.ttsVoiceId=this.value;_W();}
            });
            vidRow.appendChild(vidSel);vidRow.appendChild(customInp);
            ttsCard.appendChild(vidRow);
            /* ── 语言 行 ── */
            var _sep2=_div('');_sep2.style.cssText='height:.5px;background:rgba(255,255,255,.055);margin:0 14px;';ttsCard.appendChild(_sep2);
            var langRow=_div('v8row');langRow.style.padding='12px 14px';langRow.style.cursor='default';
            langRow.appendChild(_div('v8rb','<div class="v8rt" style="font-size:14px;">语言</div><div class="v8rs">影响发音和语调</div>'));
            var langSel=TOPDOC.createElement('select');
            langSel.style.cssText='padding:6px 10px;background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.12);border-radius:9px;color:rgba(255,255,255,.8);font-size:12px;font-family:inherit;outline:none;-webkit-appearance:none;max-width:140px;';
            [
              {v:'',     l:'自动检测'},
              {v:'zh',   l:'中文'},
              {v:'en',   l:'英语'},
              {v:'ja',   l:'日语'},
              {v:'zh,en',l:'中英混合'},
              {v:'zh,ja',l:'中日混合'}
            ].forEach(function(o){
              var opt=TOPDOC.createElement('option');opt.value=o.v;opt.textContent=o.l;
              if((char.ttsLanguage||'')===o.v)opt.selected=true;
              langSel.appendChild(opt);
            });
            langSel.addEventListener('mousedown',function(e){e.stopPropagation();});
            langSel.addEventListener('change',function(){char.ttsLanguage=this.value;_W();});
            langRow.appendChild(langSel);ttsCard.appendChild(langRow);
            /* ── 语速 行 ── */
            var _sep3=_div('');_sep3.style.cssText='height:.5px;background:rgba(255,255,255,.055);margin:0 14px;';ttsCard.appendChild(_sep3);
            var speedRow=_div('v8row');speedRow.style.padding='12px 14px';speedRow.style.cursor='default';
            speedRow.appendChild(_div('v8rb','<div class="v8rt" style="font-size:14px;">语速</div><div class="v8rs">0.5（慢）~ 2.0（快），默认 1.0</div>'));
            var speedWrap=_div('');speedWrap.style.cssText='display:flex;align-items:center;gap:6px;flex-shrink:0;';
            var speedInp=TOPDOC.createElement('input');speedInp.type='number';speedInp.min='0.5';speedInp.max='2.0';speedInp.step='0.1';
            speedInp.value=parseFloat(char.ttsSpeed)||1.0;
            speedInp.style.cssText='width:60px;padding:5px 8px;background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.12);border-radius:8px;color:rgba(255,255,255,.8);font-size:13px;text-align:center;font-family:inherit;outline:none;';
            speedInp.addEventListener('mousedown',function(e){e.stopPropagation();});
            speedInp.addEventListener('change',function(){char.ttsSpeed=Math.max(0.5,Math.min(2.0,parseFloat(this.value)||1.0));_W();});
            speedWrap.appendChild(speedInp);
            speedWrap.appendChild(_div('','<span style="font-size:12px;color:rgba(255,255,255,.35);">x</span>'));
            speedRow.appendChild(speedWrap);ttsCard.appendChild(speedRow);
          }
          body.appendChild(ttsCard);
        }

        /* ── 世界书绑定 (角色only) ── */
        if(!isUser){
          var wbEntries=_sbS.wbEntries||[];
          if(wbEntries.length){
            body.appendChild(_div('v8sec','绑定世界书'));
            var wbCard=_div('v8card');
            if(!char.wbIds)char.wbIds=[];
            wbEntries.forEach(function(e,ei){
              if(ei>0){var s=_div('');s.style.cssText='height:.5px;background:rgba(255,255,255,.055);margin:0 14px;';wbCard.appendChild(s);}
              var wbRow=_div('v8row');wbRow.style.padding='11px 14px';wbRow.style.cursor='default';
              var wbLbl=_div('v8rb');
              var nm=_div('v8rt');nm.style.fontSize='14px';nm.textContent=e.name||(e._stWbName||'条目');
              var hint=_div('v8rs');hint.style.fontSize='10px';hint.textContent=e._stWbName?('来自: '+e._stWbName):'手动条目';
              wbLbl.appendChild(nm);wbLbl.appendChild(hint);wbRow.appendChild(wbLbl);
              var isOn=char.wbIds.indexOf(e.id)>=0;
              var tog=_tog(isOn,function(eId){return function(v){
                if(v){if(char.wbIds.indexOf(eId)<0)char.wbIds.push(eId);}
                else{char.wbIds=char.wbIds.filter(function(x){return x!==eId;});}
                _W();
              };}(e.id));
              wbRow.appendChild(tog);wbCard.appendChild(wbRow);
            });
            body.appendChild(wbCard);
          }
        }

        /* ── 危险操作 (角色only) ── */
        if(!isUser){
          body.appendChild(_div('v8sec',''));
          var dangerCard=_div('v8card');
          var delRow=_div('v8row tap');delRow.style.padding='12px 14px';
          delRow.appendChild(_div('v8ic','<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.8" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>'));
          delRow.appendChild(_div('v8rb','<div class="v8rt" style="color:rgba(255,255,255,.85)">删除此联系人</div>'));
          delRow.addEventListener('click',function(e){
            e.stopPropagation();
            if(!TOP.confirm('确定删除"'+char.name+'"？'))return;
            _sbS.characters=(_sbS.characters||[]).filter(function(c){return c.id!==charId;});
            _W();_go('contacts');
          });
          dangerCard.appendChild(delRow);body.appendChild(dangerCard);
        }

        pg.appendChild(body);scr.appendChild(pg);
      }

      /* ════════════════════════════════════════════════════
         SETTINGS HOME
      ════════════════════════════════════════════════════ */
      function _pgSettings(){
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar('设置','home'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 20px;';
        /* Core settings */
        var coreItems=[
          {l:'API 设置',s:'URL · 密钥 · 模型',pg:'s-api',ic:'<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>'},
                    {l:'世界书',s:'条目管理 · 激活状态',pg:'s-wb',ic:'<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'},
          {l:'MiniMax TTS',s:'语音合成 · API 配置',pg:'s-tts',ic:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>'},
                  ];
        body.appendChild(_div('v8sec','功能配置'));
        var c1=_div('v8card');
        coreItems.forEach(function(item){
          var r=_div('v8row tap');
          r.appendChild(_div('v8ic',_svg(item.ic)));
          r.appendChild(_div('v8rb','<div class="v8rt">'+item.l+'</div><div class="v8rs">'+item.s+'</div>'));
          r.appendChild(_div('v8chev','›'));
          r.addEventListener('click',function(){_go(item.pg);});
          c1.appendChild(r);
        });
        body.appendChild(c1);
        /* Appearance */
        body.appendChild(_div('v8sec','外观'));
        var cG=_div('v8card');
        var gr=_div('v8row tap');
        gr.appendChild(_div('v8ic',_svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18"/><path d="M3.5 9h17"/><path d="M3.5 15h17"/>')));
        gr.appendChild(_div('v8rb','<div class="v8rt">液态玻璃</div><div class="v8rs">背景与按钮分组 · 折射 · 中心清晰区</div>'));
        gr.appendChild(_div('v8chev','›'));
        gr.addEventListener('click',function(){_go('s-glass');});
        cG.appendChild(gr);body.appendChild(cG);
        /* Plugin settings sections */
        var pluginsWithSettings=(_sbS.vnmApps||[]).filter(function(a){return a.enabled&&a.settingsFields&&a.settingsFields.length;});
        if(pluginsWithSettings.length){
          body.appendChild(_div('v8sec','插件配置'));
          var c2=_div('v8card');
          pluginsWithSettings.forEach(function(app){
            var r=_div('v8row tap');
            r.appendChild(_div('v8ic','<svg width="16" height="16" viewBox="0 0 24 24" style="stroke:rgba(255,255,255,.7);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;">'+app.icon+'</svg>'));
            r.appendChild(_div('v8rb','<div class="v8rt">'+app.name+'</div><div class="v8rs">'+(app.settingsTitle||app.name)+'</div>'));
            r.appendChild(_div('v8chev','›'));
            r.addEventListener('click',(function(a){return function(){_go('s-plugin',{app:a});};})(app));
            c2.appendChild(r);
          });
          body.appendChild(c2);
        }
        /* App management */
        body.appendChild(_div('v8sec','应用管理'));
        var c3=_div('v8card');
        var mr=_div('v8row tap');
        mr.appendChild(_div('v8ic',_svg('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>')));
        mr.appendChild(_div('v8rb','<div class="v8rt">已安装应用</div><div class="v8rs">'+((_sbS.vnmApps||[]).length)+'个应用</div>'));
        mr.appendChild(_div('v8chev','›'));
        mr.addEventListener('click',function(){_go('s-apps');});
        c3.appendChild(mr);body.appendChild(c3);
        pg.appendChild(body);scr.appendChild(pg);
      }

      /* ════════ 液态玻璃外观设置 ════════ */
      function _pgSGlass(){
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar('液态玻璃','settings'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 20px;';
        function _sl(card,label,key,min,max,step,dflt,unit){
          var f=_div('v8field');
          var top=_div('');top.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';
          top.appendChild(_div('','<span style="font-size:13px;color:rgba(255,255,255,.82)">'+label+'</span>'));
          var val=_div('');val.style.cssText='font-size:12px;color:rgba(255,255,255,.45);font-variant-numeric:tabular-nums;';
          var cur=(_sbS.glassUI&&_sbS.glassUI[key]!==undefined&&_sbS.glassUI[key]!==null)?_sbS.glassUI[key]:dflt;
          val.textContent=cur+unit;
          top.appendChild(val);f.appendChild(top);
          var r=TOPDOC.createElement('input');r.type='range';r.min=min;r.max=max;r.step=step;r.value=cur;
          r.style.cssText='width:100%;height:22px;cursor:pointer;accent-color:rgba(255,255,255,.9);background:transparent;border:none;display:block;';
          r.addEventListener('input',function(){_sbS.glassUI=_sbS.glassUI||{};_sbS.glassUI[key]=parseFloat(r.value);val.textContent=r.value+unit;_applyGlass();});
          r.addEventListener('change',function(){_W();});
          f.appendChild(r);card.appendChild(f);
        }
        function _grp(title,pre){
          body.appendChild(_div('v8sec',title));
          var card=_div('v8card');
          _sl(card,'模糊（清晰度）',pre+'Blur',0,40,0.5,pre==='el'?1.5:0,'px');
          _sl(card,'雾感（白膜不透明度）',pre+'Tint',0,40,1,pre==='el'?1:0,'%');
          _sl(card,'折射强度',pre+'Refr',0,150,5,60,'');
          _sl(card,'中心清晰区',pre+'Zone',0,100,1,95,'%');
          _sl(card,'饱和度',pre+'Sat',50,300,10,160,'%');
          body.appendChild(card);
        }
        _grp('背景面板','bg');
        _grp('按钮与组件','el');
        body.appendChild(_div('v8sec','通用'));
        var cardC=_div('v8card');
        _sl(cardC,'边缘高光','hl',0,100,5,20,'%');
        _sl(cardC,'圆角','radius',8,32,1,32,'px');
        _sl(cardC,'提亮','bright',90,140,1,90,'%');
        _sl(cardC,'背景遮罩深度','dim',0,80,1,23,'%');
        body.appendChild(cardC);
        var c2=_div('v8card');var r2=_div('v8row');
        r2.appendChild(_div('v8rb','<div class="v8rt">边缘折射效果</div><div class="v8rs">仿 iOS 液态玻璃边缘扭曲</div>'));
        var refOn=(_sbS.glassUI&&_sbS.glassUI.refract!==undefined&&_sbS.glassUI.refract!==null)?!!_sbS.glassUI.refract:true;
        r2.appendChild(_tog(refOn,function(v){_sbS.glassUI=_sbS.glassUI||{};_sbS.glassUI.refract=v?1:0;_W();_applyGlass();}));
        c2.appendChild(r2);body.appendChild(c2);
        var rb=_el('button','v8btn');rb.textContent='↻ 恢复默认';rb.style.margin='14px';
        rb.addEventListener('click',function(){_sbS.glassUI={};_W();_applyGlass();_render();_toast('已恢复默认外观');});
        body.appendChild(rb);
        pg.appendChild(body);scr.appendChild(pg);
      }

      /* Core settings pages via v9.25 render fns */
      function _pgSApi(){
        var pg=_div('v8pg');pg.appendChild(_navbar('API 设置','settings'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 20px;';

        /* ── API 连接 ── */
        body.appendChild(_div('v8sec','API 连接'));
        var cardConn=_div('v8card');
        var urlRow=_div('v8row');urlRow.style.cssText='flex-direction:column;align-items:stretch;padding:12px 14px;gap:6px;';
        var urlLbl=_div('');urlLbl.style.cssText='font-size:11px;color:rgba(255,255,255,.38);font-weight:500;';urlLbl.textContent='API 地址';
        var urlI=TOPDOC.createElement('input');urlI.className='v8fi';urlI.type='url';urlI.placeholder='https://api.example.com/v1';urlI.value=_sbS.apiUrl||'';
        urlI.addEventListener('mousedown',function(e){e.stopPropagation();});
        urlI.addEventListener('change',function(){_sbS.apiUrl=this.value.trim();_W();});
        urlRow.appendChild(urlLbl);urlRow.appendChild(urlI);cardConn.appendChild(urlRow);
        var _s1=_div('');_s1.style.cssText='height:.5px;background:rgba(255,255,255,.06);margin:0 14px;';cardConn.appendChild(_s1);
        var keyRow=_div('v8row');keyRow.style.cssText='flex-direction:column;align-items:stretch;padding:12px 14px;gap:6px;';
        var keyLbl=_div('');keyLbl.style.cssText='font-size:11px;color:rgba(255,255,255,.38);font-weight:500;';keyLbl.textContent='API 密钥';
        var keyI=TOPDOC.createElement('input');keyI.className='v8fi';keyI.type='password';keyI.placeholder='sk-…';keyI.value=_sbS.apiKey||'';
        keyI.addEventListener('mousedown',function(e){e.stopPropagation();});
        keyI.addEventListener('change',function(){_sbS.apiKey=this.value.trim();_W();});
        keyRow.appendChild(keyLbl);keyRow.appendChild(keyI);cardConn.appendChild(keyRow);
        body.appendChild(cardConn);

        /* ── 模型 ── */
        body.appendChild(_div('v8sec','模型'));
        var cardModel=_div('v8card');
        var modelRow=_div('v8row');modelRow.style.cssText='flex-direction:column;align-items:stretch;padding:12px 14px;gap:6px;';
        var modelLbl=_div('');modelLbl.style.cssText='font-size:11px;color:rgba(255,255,255,.38);font-weight:500;';modelLbl.textContent='模型名称';
        var modelInputRow=_div('');modelInputRow.style.cssText='display:flex;gap:8px;align-items:center;';
        var modelI=TOPDOC.createElement('input');modelI.className='v8fi';modelI.style.flex='1';modelI.placeholder='gpt-4o / claude-3-5-sonnet…';modelI.value=_sbS.model||'';
        modelI.addEventListener('mousedown',function(e){e.stopPropagation();});
        modelI.addEventListener('change',function(){_sbS.model=this.value.trim();_W();});
        var fetchMdBtn=TOPDOC.createElement('button');
        fetchMdBtn.textContent='拉取';
        fetchMdBtn.style.cssText='padding:4px 12px;font-size:11px;font-weight:500;background:rgba(255,255,255,.10);color:rgba(255,255,255,.75);border:.5px solid rgba(255,255,255,.22);border-radius:10px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:background .12s;';
        fetchMdBtn.addEventListener('mouseenter',function(){fetchMdBtn.style.background='rgba(255,255,255,.18)';});
        fetchMdBtn.addEventListener('mouseleave',function(){fetchMdBtn.style.background='rgba(255,255,255,.10)';});
        fetchMdBtn.addEventListener('click',function(e){
          e.stopPropagation();
          var u=(_sbS.apiUrl||'').replace(/\/+$/,'');
          var k=_sbS.apiKey||'';
          if(!u){TOP.alert('请先填写 API 地址');return;}
          fetchMdBtn.textContent='获取中…';fetchMdBtn.disabled=true;
          TOP.fetch(u+'/models',{method:'GET',headers:{'Authorization':'Bearer '+k,'Content-Type':'application/json'}})
          .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
          .then(function(data){
            var list=data.data||data.models||[];
            var models=list.map(function(m){return typeof m==='string'?m:(m.id||m.name||'');}).filter(Boolean);
            if(!models.length){fetchMdBtn.textContent='拉取';fetchMdBtn.disabled=false;TOP.alert('未获取到模型列表');return;}
            var mdSel=TOPDOC.getElementById('v8-model-fetch-sel');
            if(!mdSel){
              mdSel=TOPDOC.createElement('select');mdSel.id='v8-model-fetch-sel';mdSel.className='v8fi';
              mdSel.style.cssText='width:100%;margin-top:6px;';
              mdSel.addEventListener('mousedown',function(e){e.stopPropagation();});
              mdSel.addEventListener('change',function(){_sbS.model=this.value;modelI.value=this.value;_W();});
              modelRow.appendChild(mdSel);
            }
            mdSel.innerHTML='';
            models.forEach(function(m){var o=TOPDOC.createElement('option');o.value=m;o.textContent=m;if((_sbS.model||'')===m)o.selected=true;mdSel.appendChild(o);});
            fetchMdBtn.textContent='✓ '+models.length+'个';fetchMdBtn.disabled=false;
          })
          .catch(function(err){fetchMdBtn.textContent='拉取';fetchMdBtn.disabled=false;TOP.alert('拉取失败: '+err.message);});
        });
        modelInputRow.appendChild(modelI);modelInputRow.appendChild(fetchMdBtn);
        modelRow.appendChild(modelLbl);modelRow.appendChild(modelInputRow);cardModel.appendChild(modelRow);
        body.appendChild(cardModel);

        /* ── API 预设 ── */
        body.appendChild(_div('v8sec','API 预设'));
        var cardApiPr=_div('v8card');
        var apiPrBar=_div('');apiPrBar.style.cssText='display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px;align-items:center;';
        var saveApiPrBtn=TOPDOC.createElement('button');
        saveApiPrBtn.textContent='保存预设';
        saveApiPrBtn.style.cssText='padding:4px 12px;font-size:11px;font-weight:500;background:rgba(255,255,255,.10);color:rgba(255,255,255,.70);border:.5px solid rgba(255,255,255,.20);border-radius:10px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:background .12s;';
        saveApiPrBtn.addEventListener('mouseenter',function(){saveApiPrBtn.style.background='rgba(255,255,255,.18)';});
        saveApiPrBtn.addEventListener('mouseleave',function(){saveApiPrBtn.style.background='rgba(255,255,255,.10)';});
        function _renderApiPresets(){
          while(apiPrBar.children.length>1)apiPrBar.removeChild(apiPrBar.lastChild);
          var presets=_sbS.apiPresets||[];
          presets.forEach(function(p,pi){
            var pill=TOPDOC.createElement('span');
            pill.style.cssText='display:inline-flex;align-items:center;gap:4px;padding:3px 10px;font-size:11px;background:rgba(255,255,255,.09);color:rgba(255,255,255,.72);border:.5px solid rgba(255,255,255,.18);border-radius:20px;cursor:pointer;max-width:160px;transition:background .12s;';
            pill.addEventListener('mouseenter',function(){pill.style.background='rgba(255,255,255,.16)';});
            pill.addEventListener('mouseleave',function(){pill.style.background='rgba(255,255,255,.09)';});
            var lbl=TOPDOC.createElement('span');lbl.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';lbl.textContent=p.name;
            var x=TOPDOC.createElement('span');x.textContent='×';x.style.cssText='flex-shrink:0;font-size:13px;line-height:1;color:rgba(255,255,255,.40);margin-left:2px;';
            pill.appendChild(lbl);pill.appendChild(x);
            lbl.addEventListener('click',function(ev){ev.stopPropagation();
              _sbS.apiUrl=p.url||'';_sbS.apiKey=p.key||'';_sbS.model=p.model||'';_W();
              urlI.value=_sbS.apiUrl;keyI.value=_sbS.apiKey;modelI.value=_sbS.model;
              _toast('已应用预设「'+p.name+'」');
            });
            x.addEventListener('click',function(ev){ev.stopPropagation();
              if(!_sbS.apiPresets)return;_sbS.apiPresets.splice(pi,1);_W();_renderApiPresets();
            });
            apiPrBar.appendChild(pill);
          });
        }
        saveApiPrBtn.addEventListener('click',function(e){e.stopPropagation();
          var nm=TOP.prompt('预设名称：');if(!nm||!nm.trim())return;
          if(!_sbS.apiPresets)_sbS.apiPresets=[];
          _sbS.apiPresets.push({id:_uuid(),name:nm.trim(),url:_sbS.apiUrl||'',key:_sbS.apiKey||'',model:_sbS.model||''});
          _W();_renderApiPresets();
        });
        apiPrBar.appendChild(saveApiPrBtn);
        _renderApiPresets();
        cardApiPr.appendChild(apiPrBar);
        body.appendChild(cardApiPr);

        /* ── 数据缓存 ── */
        body.appendChild(_div('v8sec','数据'));
        var cardData=_div('v8card');
        var clrRow=_div('v8row tap');clrRow.style.borderBottom='none';
        clrRow.appendChild(_div('v8rb','<div class="v8rt" style="color:rgba(255,255,255,.7)">清空所有缓存数据</div>'));
        clrRow.addEventListener('click',function(e){
          e.stopPropagation();
          if(!TOP.confirm('确定清空所有缓存？'))return;
          _sbS.history={};_sbS.injectCharIds=[];
          _W();_toast('已清空所有缓存');
        });
        cardData.appendChild(clrRow);body.appendChild(cardData);

        pg.appendChild(body);scr.appendChild(pg);
      }
      function _pgSChars()  {_wrapLegacy('角色管理',   'settings',_renderCharsTab);}
      function _pgSPresets(){_wrapLegacy('对话预设',   'settings',_renderPresetsTab);}
      function _pgSWb(){
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar('世界书','settings'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 20px;';

        function _drawWb(){
          while(body.firstChild)body.removeChild(body.firstChild);
          var entries=_sbS.wbEntries||[];

          /* ── Pull from ST button ── */
          var sec0=_div('v8sec','操作');body.appendChild(sec0);
          var card0=_div('v8card');
          var pullRow=_div('v8row');
          var pullLbl=_div('');pullLbl.style.cssText='flex:1;font-size:14px;color:rgba(255,255,255,.85);';pullLbl.textContent='从 SillyTavern 拉取';
          var pullBtn=TOPDOC.createElement('button');pullBtn.textContent='拉取';
          pullBtn.style.cssText='background:rgba(255,255,255,.18);color:#fff;border:.5px solid rgba(255,255,255,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.25);border-radius:8px;padding:5px 14px;font-size:13px;cursor:pointer;flex-shrink:0;';
          pullBtn.onclick=function(){_pullSTWb();TOP.setTimeout(_drawWb,400);};
          pullRow.appendChild(pullLbl);pullRow.appendChild(pullBtn);card0.appendChild(pullRow);
          /* Add manual entry */
          var addRow=_div('v8row');addRow.style.borderBottom='none';
          var addLbl=_div('');addLbl.style.cssText='flex:1;font-size:14px;color:rgba(255,255,255,.85);';addLbl.textContent='手动添加条目';
          var addBtn=TOPDOC.createElement('button');addBtn.textContent='添加';
          addBtn.style.cssText='background:rgba(255,255,255,.18);color:#fff;border:.5px solid rgba(255,255,255,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.25);border-radius:8px;padding:5px 14px;font-size:13px;cursor:pointer;flex-shrink:0;';
          addBtn.onclick=function(){
            var ne={id:_uuid(),name:'新条目',content:'',enabled:true};
            (_sbS.wbEntries=_sbS.wbEntries||[]).push(ne);
            (_sbS.wbActive=_sbS.wbActive||[]).push(ne.id);
            _W();_drawWb();
          };
          addRow.appendChild(addLbl);addRow.appendChild(addBtn);card0.appendChild(addRow);
          body.appendChild(card0);

          if(!entries.length){
            var empty=_div('');empty.style.cssText='text-align:center;padding:40px 20px;font-size:13px;color:rgba(255,255,255,.3);';
            empty.textContent='暂无条目，点击"拉取"或"添加"';
            body.appendChild(empty);
            pg.appendChild(body);if(!pg.parentNode)scr.appendChild(pg);return;
          }

          /* ── Group ST entries ── */
          var stGroups={},stOrder=[];
          var manual=[];
          entries.forEach(function(e){
            if(e._stWb){var gn=e._stWbName||'未知世界书';if(!stGroups[gn]){stGroups[gn]=[];stOrder.push(gn);}stGroups[gn].push(e);}
            else{manual.push(e);}
          });

          function _makeEntryRow(e,isLast){
            var row=_div('v8row');if(isLast)row.style.borderBottom='none';
            /* 名称（可内联编辑） */
            var nameEl=TOPDOC.createElement('input');nameEl.className='v8fi';
            nameEl.style.cssText='flex:1;margin-right:10px;padding:5px 8px;font-size:13px;background:rgba(255,255,255,.06);border-radius:8px;border:.5px solid rgba(255,255,255,.1);color:rgba(255,255,255,.85);';
            nameEl.value=e.name||'';
            nameEl.placeholder='条目名称';
            nameEl.addEventListener('mousedown',function(ev){ev.stopPropagation();});
            nameEl.addEventListener('change',function(){e.name=this.value.trim();_W();});
            /* 删除按钮 */
            var del=TOPDOC.createElement('button');del.textContent='✕';
            del.style.cssText='background:rgba(255,255,255,.16);color:#fff;border:none;border-radius:6px;width:26px;height:26px;font-size:12px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;';
            del.onclick=function(){
              _sbS.wbEntries=(_sbS.wbEntries||[]).filter(function(x){return x.id!==e.id;});
              _W();_drawWb();
            };
            row.appendChild(nameEl);row.appendChild(del);
            return row;
          }

          /* ST groups */
          stOrder.forEach(function(gname){
            var gEntries=stGroups[gname];
            var collapsed=!!(_ui.wbCollapsed&&_ui.wbCollapsed[gname]);
            body.appendChild(_div('v8sec',gname));
            var card=_div('v8card');
            /* Group header row */
            var ghRow=_div('v8row');
            var chev=_div('');chev.style.cssText='font-size:12px;color:rgba(255,255,255,.4);margin-right:6px;transition:transform .15s;transform:'+(collapsed?'rotate(-90deg)':'rotate(0deg)')+';';
            chev.textContent='▾';
            var gnLbl=_div('');gnLbl.style.cssText='flex:1;font-size:13px;font-weight:600;color:rgba(255,255,255,.7);';
            gnLbl.textContent=gname+' ('+gEntries.length+')';
            ghRow.appendChild(chev);ghRow.appendChild(gnLbl);
            /* 删除整本按钮 */
            var delGrpBtn=TOPDOC.createElement('button');
            delGrpBtn.textContent='删除整本';
            delGrpBtn.style.cssText='flex-shrink:0;padding:4px 12px;font-size:11px;font-weight:500;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.75);border:.5px solid rgba(255,255,255,0.20);border-radius:10px;cursor:pointer;font-family:inherit;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:inset 0 1px 0 rgba(255,255,255,0.10);transition:background .12s;';
            delGrpBtn.addEventListener('mouseenter',function(){delGrpBtn.style.background='rgba(255,255,255,0.13)';});
            delGrpBtn.addEventListener('mouseleave',function(){delGrpBtn.style.background='rgba(255,255,255,0.07)';});
            delGrpBtn.addEventListener('click',function(ev){
              ev.stopPropagation();
              var ids=gEntries.map(function(e){return e.id;});
              _sbS.wbEntries=(_sbS.wbEntries||[]).filter(function(e){return ids.indexOf(e.id)<0;});
              _W();_drawWb();
            });
            ghRow.appendChild(delGrpBtn);
            ghRow.style.cursor='pointer';ghRow.style.userSelect='none';
            ghRow.onclick=function(){
              if(!_ui.wbCollapsed)_ui.wbCollapsed={};
              _ui.wbCollapsed[gname]=!_ui.wbCollapsed[gname];
              _drawWb();
            };
            card.appendChild(ghRow);
            if(!collapsed){
              gEntries.forEach(function(e,i){card.appendChild(_makeEntryRow(e,i===gEntries.length-1));});
            }
            body.appendChild(card);
          });

          /* Manual entries */
          if(manual.length){
            body.appendChild(_div('v8sec','手动条目'));
            var mCard=_div('v8card');
            manual.forEach(function(e,i){mCard.appendChild(_makeEntryRow(e,i===manual.length-1));});
            body.appendChild(mCard);
          }

          if(!pg.parentNode)scr.appendChild(pg);
        }

        _drawWb();
        pg.appendChild(body);scr.appendChild(pg);
      }

      /* ════════ SETTINGS: TTS ════════ */
      function _pgSTts(){
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar('MiniMax TTS','settings'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 20px;';
        body.appendChild(_div('v8sec','全局开关'));
        var c1=_div('v8card');
        var togRow=_div('v8row');togRow.style.cursor='default';
        togRow.appendChild(_div('v8rb','<div class="v8rt">启用 TTS 语音合成</div>'));
        togRow.appendChild(_tog(_sbS.ttsEnabled,function(v){_sbS.ttsEnabled=v;_W();}));
        c1.appendChild(togRow);body.appendChild(c1);
        body.appendChild(_div('v8sec','API 配置'));
        var c2=_div('v8card');
        /* Group ID */
        var _tGRow=_div('v8row');_tGRow.style.cssText='flex-direction:column;align-items:stretch;padding:12px 14px;gap:6px;';
        var _tGLbl=_div('');_tGLbl.style.cssText='font-size:11px;color:rgba(255,255,255,.38);font-weight:500;';_tGLbl.textContent='Group ID';
        var _tGInp=TOPDOC.createElement('input');_tGInp.className='v8fi';_tGInp.type='text';_tGInp.placeholder='xxxxxxxxxx';_tGInp.value=_sbS.ttsGroupId||'';
        _tGInp.addEventListener('mousedown',function(e){e.stopPropagation();});
        _tGInp.addEventListener('change',function(){_sbS.ttsGroupId=this.value.trim();_W();});
        _tGRow.appendChild(_tGLbl);_tGRow.appendChild(_tGInp);c2.appendChild(_tGRow);
        c2.appendChild((function(){var s=_div('');s.style.cssText='height:.5px;background:rgba(255,255,255,.06);margin:0 14px;';return s;})());
        /* API Key */
        var _tKRow=_div('v8row');_tKRow.style.cssText='flex-direction:column;align-items:stretch;padding:12px 14px;gap:6px;';
        var _tKLbl=_div('');_tKLbl.style.cssText='font-size:11px;color:rgba(255,255,255,.38);font-weight:500;';_tKLbl.textContent='API Key';
        var _tKInp=TOPDOC.createElement('input');_tKInp.className='v8fi';_tKInp.type='password';_tKInp.placeholder='MiniMax API Key';_tKInp.value=_sbS.ttsApiKey||'';
        _tKInp.addEventListener('mousedown',function(e){e.stopPropagation();});
        _tKInp.addEventListener('change',function(){_sbS.ttsApiKey=this.value.trim();_W();});
        _tKRow.appendChild(_tKLbl);_tKRow.appendChild(_tKInp);c2.appendChild(_tKRow);
        c2.appendChild((function(){var s=_div('');s.style.cssText='height:.5px;background:rgba(255,255,255,.06);margin:0 14px;';return s;})());
        /* API Host */
        var _tHRow=_div('v8row');_tHRow.style.cssText='flex-direction:column;align-items:stretch;padding:12px 14px;gap:6px;';
        var _tHLbl=_div('');_tHLbl.style.cssText='font-size:11px;color:rgba(255,255,255,.38);font-weight:500;';_tHLbl.textContent='API Host';
        var _tHInp=TOPDOC.createElement('input');_tHInp.className='v8fi';_tHInp.type='url';_tHInp.placeholder='https://api.minimax.chat';_tHInp.value=_sbS.ttsApiHost||'';
        _tHInp.addEventListener('mousedown',function(e){e.stopPropagation();});
        _tHInp.addEventListener('change',function(){_sbS.ttsApiHost=this.value.trim();_W();});
        _tHRow.appendChild(_tHLbl);_tHRow.appendChild(_tHInp);c2.appendChild(_tHRow);
        c2.appendChild((function(){var s=_div('');s.style.cssText='height:.5px;background:rgba(255,255,255,.06);margin:0 14px;';return s;})());
        /* TTS 模型 + 拉取 */
        var _tMRow=_div('v8row');_tMRow.style.cssText='padding:12px 14px;flex-wrap:wrap;gap:8px;align-items:center;';
        _tMRow.appendChild(_div('v8rb','<div class="v8rt">语音模型</div>'));
        var _tMSel=TOPDOC.createElement('select');_tMSel.className='v8fi';_tMSel.style.cssText='max-width:180px;font-size:13px;flex:1;';
        var _defTtsMdl=['speech-02-hd','speech-02-turbo','speech-02','speech-01-hd','speech-01','speech-01-turbo'];
        function _fillTtsMdl(list){
          _tMSel.innerHTML='';
          list.forEach(function(m){var o=TOPDOC.createElement('option');o.value=m;o.textContent=m;if((_sbS.ttsModel||'speech-02-hd')===m)o.selected=true;_tMSel.appendChild(o);});
        }
        _fillTtsMdl(_defTtsMdl);
        _tMSel.addEventListener('mousedown',function(e){e.stopPropagation();});
        _tMSel.addEventListener('change',function(){_sbS.ttsModel=this.value;_W();});
        var _tFBtn=TOPDOC.createElement('button');
        _tFBtn.textContent='拉取';
        _tFBtn.style.cssText='padding:4px 12px;font-size:11px;font-weight:500;background:rgba(255,255,255,.10);color:rgba(255,255,255,.75);border:.5px solid rgba(255,255,255,.22);border-radius:10px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:background .12s;';
        _tFBtn.addEventListener('mouseenter',function(){_tFBtn.style.background='rgba(255,255,255,.18)';});
        _tFBtn.addEventListener('mouseleave',function(){_tFBtn.style.background='rgba(255,255,255,.10)';});
        _tFBtn.addEventListener('click',function(e){
          e.stopPropagation();
          var host=(_sbS.ttsApiHost||'https://api.minimax.chat').replace(/\/+$/,'');
          var key=_sbS.ttsApiKey||'';
          var gid=_sbS.ttsGroupId||'';
          if(!key){TOP.alert('请先填写 API Key');return;}
          _tFBtn.textContent='获取中…';_tFBtn.disabled=true;
          var url=host+'/v1/models'+(gid?'?GroupId='+gid:'');
          TOP.fetch(url,{method:'GET',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'}})
          .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
          .then(function(data){
            var models=[];
            var list=data.data||data.models||data.result||[];
            list.forEach(function(m){
              var id=typeof m==='string'?m:(m.id||m.model_id||m.name||'');
              if(id&&(id.indexOf('speech')>=0||id.indexOf('tts')>=0||id.indexOf('t2a')>=0))models.push(id);
            });
            _defTtsMdl.forEach(function(m){if(models.indexOf(m)<0)models.push(m);});
            models=models.filter(function(v,i,a){return a.indexOf(v)===i;});
            _fillTtsMdl(models);
            _tFBtn.textContent='✓ 已拉取('+models.length+')';_tFBtn.disabled=false;
          })
          .catch(function(err){
            _fillTtsMdl(_defTtsMdl);
            _tFBtn.textContent='拉取';_tFBtn.disabled=false;
            TOP.alert('拉取失败('+err.message+'\n已恢复默认列表');
          });
        });
        _tMRow.appendChild(_tMSel);_tMRow.appendChild(_tFBtn);c2.appendChild(_tMRow);
        body.appendChild(c2);pg.appendChild(body);scr.appendChild(pg);
      }

      /* ════════ SETTINGS: VOICE CALL PRESET ════════ */
      function _defaultVcPrompt(){return'你正在扮演{{角色名称}}与{{用户名称}}进行对话。\n【角色设定】\n{{角色设定}}\n【用户设定】\n{{用户设定}}\n【世界背景信息】\n{{世界书}}\n【当前{{用户名称}}经历信息】\n{{酒馆历史}}\n请用简短自然的口语风格回复，30字以内，不使用任何 Markdown 格式，只说话不描述动作。';}
      function _pgSVc(){
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar('语音通话预设','settings'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 12px 20px;';
        body.appendChild(_div('v8sec','可用变量（点击插入光标处）'));
        var vw=_div('');vw.style.cssText='display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;';
        [['{{角色名称}}','角色名字'],['{{角色设定}}','角色人设'],['{{用户名称}}','用户名字'],
         ['{{用户设定}}','用户人设'],['{{角色状态}}','最新状态'],['{{世界书}}','激活条目'],['{{当前时间}}','日期时间']
        ].forEach(function(v){
          var b=_div('');b.style.cssText='padding:3px 9px;background:rgba(255,255,255,.07);border:.5px solid rgba(255,255,255,.12);border-radius:20px;font-size:11px;color:rgba(255,255,255,.6);cursor:pointer;';
          b.textContent=v[0];b.title=v[1];
          b.addEventListener('mousedown',function(e){e.stopPropagation();});
          b.addEventListener('click',function(){
            var ta=TOPDOC.getElementById('v8vc-ta');if(!ta)return;
            var s=ta.selectionStart,e2=ta.selectionEnd;
            ta.value=ta.value.slice(0,s)+v[0]+ta.value.slice(e2);
            ta.selectionStart=ta.selectionEnd=s+v[0].length;ta.focus();
            _sbS.vcSystemPrompt=ta.value;_W();
          });vw.appendChild(b);
        });
        body.appendChild(vw);
        body.appendChild(_div('v8sec','系统提示词'));
        var ta=TOPDOC.createElement('textarea');ta.id='v8vc-ta';ta.className='v8ta';
        ta.style.height='165px';ta.value=_sbS.vcSystemPrompt||_defaultVcPrompt();
        ta.addEventListener('mousedown',function(e){e.stopPropagation();});
        ta.addEventListener('input',function(){_sbS.vcSystemPrompt=this.value;_W();});
        body.appendChild(ta);
        /* ── 提示词预设栏 ── */
        var presetBar=_div('');presetBar.style.cssText='display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 0 2px;';
        var savePBtn=TOPDOC.createElement('button');
        savePBtn.textContent='保存预设';
        savePBtn.style.cssText='padding:4px 12px;font-size:11px;background:rgba(255,255,255,.10);color:rgba(255,255,255,.70);border:.5px solid rgba(255,255,255,.20);border-radius:10px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:background .12s;';
        savePBtn.addEventListener('mouseenter',function(){savePBtn.style.background='rgba(255,255,255,.18)';});
        savePBtn.addEventListener('mouseleave',function(){savePBtn.style.background='rgba(255,255,255,.10)';});
        function _renderPresetPills(){
          while(presetBar.children.length>1)presetBar.removeChild(presetBar.lastChild);
          var presets=_sbS.vcPromptPresets||[];
          presets.forEach(function(p,pi){
            var pill=TOPDOC.createElement('span');
            pill.style.cssText='display:inline-flex;align-items:center;gap:4px;padding:3px 10px;font-size:11px;background:rgba(255,255,255,.09);color:rgba(255,255,255,.72);border:.5px solid rgba(255,255,255,.18);border-radius:20px;cursor:pointer;max-width:140px;';
            var lbl=TOPDOC.createElement('span');lbl.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';lbl.textContent=p.name;
            var x=TOPDOC.createElement('span');x.textContent='×';x.style.cssText='flex-shrink:0;font-size:13px;line-height:1;color:rgba(255,255,255,.40);margin-left:2px;';
            pill.appendChild(lbl);pill.appendChild(x);
            lbl.addEventListener('click',function(ev){ev.stopPropagation();
              var t=TOPDOC.getElementById('v8vc-ta');if(t){t.value=p.content;_sbS.vcSystemPrompt=p.content;_W();}
            });
            x.addEventListener('click',function(ev){ev.stopPropagation();
              (_sbS.vcPromptPresets||[]).splice(pi,1);_W();_renderPresetPills();
            });
            presetBar.appendChild(pill);
          });
        }
        savePBtn.addEventListener('click',function(e){e.stopPropagation();
          var nm=TOP.prompt('预设名称：');if(!nm||!nm.trim())return;
          var cur=TOPDOC.getElementById('v8vc-ta');var val=cur?cur.value:(_sbS.vcSystemPrompt||'');
          if(!_sbS.vcPromptPresets)_sbS.vcPromptPresets=[];
          _sbS.vcPromptPresets.push({name:nm.trim(),content:val});_W();
          _renderPresetPills();
        });
        presetBar.appendChild(savePBtn);
        _renderPresetPills();
        body.appendChild(presetBar);
        body.appendChild(_div('v8sec','上下文轮数'));
        var dRow=_div('');dRow.style.cssText='display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.055);border:.5px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;margin-bottom:10px;';
        dRow.appendChild(_div('','<span style="font-size:14px;color:rgba(255,255,255,.85)">注入最近轮数</span>'));
        var di=TOPDOC.createElement('input');di.type='number';di.min='1';di.max='20';di.value=_sbS.vcContextDepth||6;
        di.style.cssText='width:44px;text-align:center;background:rgba(255,255,255,.1);border:.5px solid rgba(255,255,255,.12);border-radius:8px;color:rgba(255,255,255,.88);padding:4px;font-size:14px;font-family:inherit;outline:none;';
        di.addEventListener('mousedown',function(e){e.stopPropagation();});
        di.addEventListener('change',function(){_sbS.vcContextDepth=parseInt(this.value)||6;_W();});
        dRow.appendChild(di);body.appendChild(dRow);
        var rst=_div('v8btn del','');rst.innerHTML='恢复默认提示词';rst.style.width='100%';rst.style.boxSizing='border-box';
        rst.addEventListener('click',function(){_sbS.vcSystemPrompt=_defaultVcPrompt();_W();var t=TOPDOC.getElementById('v8vc-ta');if(t)t.value=_sbS.vcSystemPrompt;});
        body.appendChild(rst);pg.appendChild(body);scr.appendChild(pg);
      }

      /* ════════ SETTINGS: PLUGIN FIELDS ════════ */
      function _pgSPlugin(){
        var app=_nav.data&&_nav.data.app;if(!app){_go('settings');return;}
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar(app.settingsTitle||app.name,'settings'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 20px;';
        if(!app.settingsFields||!app.settingsFields.length){
          body.appendChild(_div('','<div style="padding:30px;text-align:center;font-size:13px;color:rgba(255,255,255,.3)">该应用无设置项</div>'));
        } else {
          var groups={};var order=[];
          (app.settingsFields||[]).forEach(function(f){
            var g=f.group||'配置';if(!groups[g]){groups[g]=[];order.push(g);}groups[g].push(f);
          });
          if(!app.settingsValues)app.settingsValues={};
          order.forEach(function(g){
            var hdr=_div('v8sec');
            hdr.style.cssText+='cursor:pointer;user-select:none;-webkit-user-select:none;display:flex;align-items:center;gap:4px;';
            var arr=TOPDOC.createElement('span');arr.style.cssText='display:inline-block;font-size:10px;transition:transform .18s;flex-shrink:0;';arr.textContent='▾';
            hdr.appendChild(arr);hdr.appendChild(TOPDOC.createTextNode(g));
            var c=_div('v8card');
            groups[g].forEach(function(f){c.appendChild(_fieldRow(f,app.settingsValues));});
            var _collapsed=false;
            hdr.addEventListener('click',function(){
              _collapsed=!_collapsed;
              c.style.display=_collapsed?'none':'';
              arr.style.transform=_collapsed?'rotate(-90deg)':'rotate(0deg)';
            });
            body.appendChild(hdr);
            body.appendChild(c);
          });
        }
        pg.appendChild(body);scr.appendChild(pg);
      }

      /* ════════ SETTINGS: APP MANAGEMENT ════════ */
      function _pgSApps(){
        var pg=_div('v8pg v8sl');pg.appendChild(_navbar('已安装应用','settings'));
        var body=_div('');body.style.cssText='flex:1;overflow-y:auto;padding:4px 0 20px;';
        var apps=_sbS.vnmApps||[];
        if(!apps.length){
          body.appendChild(_div('','<div style="padding:40px;text-align:center;font-size:13px;color:rgba(255,255,255,.3)">暂无已安装应用<br><span style="font-size:11px;color:rgba(255,255,255,.2)">在主屏点击「导入 App」添加</span></div>'));
        } else {
          body.appendChild(_div('v8sec','应用列表'));
          var c=_div('v8card');
          apps.forEach(function(app,i){
            var r=_div('v8row');r.style.cursor='default';
            r.appendChild(_div('v8ic','<svg width="16" height="16" viewBox="0 0 24 24" style="stroke:rgba(255,255,255,.65);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;">'+app.icon+'</svg>'));
            var bd=_div('v8rb');
            bd.appendChild(_div('v8rt',app.name));
            bd.appendChild(_div('v8rs','v'+app.version+' · '+(app.injectEnabled?'注入已开':'')+(app.injectEnabled&&app.settingsFields&&app.settingsFields.length?' · ':'')+((app.settingsFields&&app.settingsFields.length)?'有设置项':'')));
            r.appendChild(bd);
            var tog=_tog(app.enabled,function(v){app.enabled=v;_W();_updatePluginInjection();_render();});
            r.appendChild(tog);
            var del=_div('');del.style.cssText='width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,.5);margin-left:6px;flex-shrink:0;';
            del.innerHTML=_svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>',15);
            del.addEventListener('click',function(){
              apps.splice(i,1);_sbS.vnmApps=apps;_W();_updatePluginInjection();_render();
            });
            r.appendChild(del);c.appendChild(r);
          });
          body.appendChild(c);
        }
        pg.appendChild(body);scr.appendChild(pg);
      }

      /* ════════ PLUGIN APP PAGE ════════ */
      function _pgAppRun(){
        var app=_nav.data&&_nav.data.app;if(!app||!app.pageCode){_go('home');return;}
        var pg=_div('v8pg v8sl');
        try{
          var ctx=_makePluginCtx(app);
          ctx.back=function(){_go('home');};
          ctx.go=_go;
          ctx.div=function(cls,html){return _div(cls,html);};
          ctx.el=function(tag,cls,html){return _el(tag,cls,html);};
          ctx.svg=_svg;
          var fn=new TOP.Function('ctx','return('+app.pageCode+')(ctx);');
          var content=fn(ctx);
          pg.appendChild(_navbar(app.name,'home'));
          if(content)pg.appendChild(content);
        }catch(e){
          pg.appendChild(_navbar(app.name,'home'));
          pg.appendChild(_div('','<div style="padding:20px;font-size:12px;color:rgba(255,255,255,.75)">App 运行错误:<br>'+e.message+'</div>'));
        }
        scr.appendChild(pg);
      }

      /* ════════ ROUTER ════════ */
      var _pages={
        home:_pgHome, settings:_pgSettings,
        contacts:_pgContacts,'contact-detail':_pgContactDetail,
        's-api':_pgSApi,'s-chars':_pgSChars,'s-presets':_pgSPresets,'s-wb':_pgSWb,
        's-tts':_pgSTts,'s-vc':_pgSVc,'s-plugin':_pgSPlugin,'s-apps':_pgSApps,'s-glass':_pgSGlass,
        'app-run':_pgAppRun,
      };
      function _render(){
        var _s=TOP._v8scr||scr;
        var oldEl=_s.lastElementChild;
        try{(_pages[_nav.page]||_pgHome)();}catch(e){console.error('[VNM v8]',_nav.page,e);return;}
        var newEl=_s.lastElementChild;
        if(!oldEl||oldEl===newEl){return;}
        /* Fade new over old, then remove old */
        newEl.classList.remove('v8sl');
        newEl.style.opacity='0';
        newEl.style.transition='none';
        requestAnimationFrame(function(){
          newEl.style.transition='opacity .15s ease';
          newEl.style.opacity='1';
          TOP.setTimeout(function(){
            if(oldEl.parentNode)oldEl.parentNode.removeChild(oldEl);
            newEl.style.transition='';
          },180);
        });
      }
      TOP._v8render=_render;
      _render();

      var wrap=TOPDOC.createElement('div');wrap.style.cssText='flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;';
      wrap.appendChild(shell);return wrap;
    }


    // ── Tab: Presets ─────────────────────────────────────
    function _renderPresetsTab(){
      var f=TOPDOC.createDocumentFragment();
      var irow=_row();irow.style.gap='6px;flex-wrap:wrap';
      // 新建预设
      var newPBtn=_pbtn('+ 新建','blue');
      newPBtn.addEventListener('click',function(e){
        e.stopPropagation();
        var np={id:_uuid(),name:'新预设',promptSuffix:'',regexPattern:'',replacePattern:''};
        _sbS.presets.push(np);_sbS.activePresetId=np.id;
        _ui.editPresetId=np.id;_W();_renderTab();_updateTitle();
      });
      // 导出当前预设
      var expPBtn=_pbtn('导出预设','default');
      expPBtn.addEventListener('click',function(e){
        e.stopPropagation();
        var ap=_ap();if(!ap){_toast('无激活预设');return;}
        try{
          var blob=new TOP.Blob([JSON.stringify(ap,null,2)],{type:'application/json'});
          var url=TOP.URL.createObjectURL(blob);
          var a=TOPDOC.createElement('a');
          a.href=url;a.download=(ap.name||'preset')+'.json';
          TOPDOC.body.appendChild(a);a.click();TOPDOC.body.removeChild(a);
          TOP.URL.revokeObjectURL(url);_toast('预设已导出');
        }catch(err){_toast('导出失败');}
      });
      var impBtn=_pbtn('导入 JSON','blue');
      var impFile=TOPDOC.createElement('input');impFile.type='file';impFile.accept='.json';impFile.style.display='none';
      impBtn.addEventListener('click',function(e){e.stopPropagation();impFile.click();});
      impFile.addEventListener('change',function(){
        var file=this.files[0];if(!file)return;
        var reader=new TOP.FileReader();
        reader.onload=function(ev){
          try{
            var p=JSON.parse(ev.target.result);
            if(!p.replacePattern)throw new Error('缺少 replacePattern');
            var preset={id:_uuid(),name:p.name||file.name.replace(/\.json$/i,''),promptSuffix:p.promptSuffix||'',regexPattern:p.regexPattern||'',replacePattern:p.replacePattern};
            _sbS.presets.push(preset);
            if(!_sbS.activePresetId)_sbS.activePresetId=preset.id;
            _W();_renderTab();_updateTitle();_toast('预设 "'+preset.name+'" 已导入');
          }catch(err){_toast('格式错误: '+err.message);}
        };
        reader.readAsText(file);this.value='';
      });
      irow.appendChild(newPBtn);irow.appendChild(expPBtn);irow.appendChild(impBtn);irow.appendChild(impFile);
      f.appendChild(irow);

      if(!_sbS.presets.length){
        var em=TOPDOC.createElement('div');
        em.style.cssText='font-size:12px;color:'+C.text3+';padding:16px 0;text-align:center;';
        em.textContent='暂无预设，点击「导入 JSON」';f.appendChild(em);
      } else {
        _sbS.presets.forEach(function(preset){
          var isActive=preset.id===_sbS.activePresetId;
          var isEdit=_ui.editPresetId===preset.id;
          var card=TOPDOC.createElement('div');
          card.style.cssText=
            'background:'+(isActive?'rgba(255,255,255,0.10)':C.surface)+';'
            +'border-radius:14px;overflow:hidden;margin-top:8px;'
            +'border:0.5px solid '+(isActive?'rgba(255,255,255,0.20)':C.border)+';';
          // Header row
          var hr=TOPDOC.createElement('div');
          hr.style.cssText='display:flex;align-items:center;gap:8px;padding:10px 12px;';
          var ns=TOPDOC.createElement('span');
          ns.style.cssText='flex:1;font-size:13px;font-weight:'+(isActive?'600':'400')+';color:'+(isActive?C.blue:C.text2)+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          ns.textContent=preset.name;
          var actB=_pbtn(isActive?'✓ 已激活':'激活',isActive?'blue':'default');
          actB.addEventListener('click',function(e){e.stopPropagation();_sbS.activePresetId=preset.id;_W();_renderTab();_updateTitle();});
          var edB=_pbtn(isEdit?'收起':'编辑','default');
          edB.addEventListener('click',function(e){e.stopPropagation();_ui.editPresetId=isEdit?null:preset.id;_renderTab();});
          var delB=_pbtn('删除','red');
          delB.addEventListener('click',function(e){
            e.stopPropagation();
            if(!TOP.confirm('删除预设 "'+preset.name+'"？'))return;
            _sbS.presets=_sbS.presets.filter(function(p){return p.id!==preset.id;});
            if(_sbS.activePresetId===preset.id)_sbS.activePresetId=_sbS.presets.length?_sbS.presets[0].id:null;
            _W();_renderTab();_updateTitle();
          });
          hr.appendChild(ns);hr.appendChild(actB);hr.appendChild(edB);hr.appendChild(delB);
          card.appendChild(hr);
          if(isEdit){
            var sep=TOPDOC.createElement('div');sep.style.cssText='height:0.5px;background:'+C.border+';margin:0 12px;';
            card.appendChild(sep);
            var ep=TOPDOC.createElement('div');ep.style.cssText='padding:4px 12px 12px;display:flex;flex-direction:column;gap:4px;';
            var nI=_inp('预设名称','text',preset.name);
            var psT=_ta('System Prompt (promptSuffix)',preset.promptSuffix,5);
            var rpT=_ta('提取正则 (regexPattern)',preset.regexPattern,3);
            var htT=_ta('HTML 模板 (replacePattern)',preset.replacePattern,5);
            var sB=_pbtn('保存','green');
            sB.addEventListener('click',function(e){
              e.stopPropagation();
              preset.name=nI.value.trim()||preset.name;
              preset.promptSuffix=psT.value;preset.regexPattern=rpT.value;preset.replacePattern=htT.value;
              _ui.editPresetId=null;_W();_renderTab();_updateTitle();_toast('预设已保存');
            });
            var sr=_row();sr.appendChild(sB);
            [_lbl('名称'),nI,_lbl('System Prompt'),psT,_lbl('提取正则'),rpT,_lbl('HTML 模板'),htT,sr]
              .forEach(function(el){ep.appendChild(el);});
            card.appendChild(ep);
          }
          f.appendChild(card);
        });
      }
      var wrap=TOPDOC.createElement('div');wrap.appendChild(f);return wrap;
    }

    // ── Tab: Characters ───────────────────────────────────
    
    // ── 世界书 Tab ───────────────────────────────────────────
    function _renderWbTab(){
      var f=TOPDOC.createDocumentFragment();

      // ── header row: title + add button ──────────────────────
      var hdr=TOPDOC.createElement('div');
      hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:2px 0 10px;';
      var htitle=TOPDOC.createElement('span');
      htitle.style.cssText='font-size:12px;font-weight:600;color:'+C.text2+';letter-spacing:.3px;text-transform:uppercase;';
      htitle.textContent='世界书条目';
      var hadd=_pbtn('+ 手动添加','blue');
      hadd.style.cssText+='padding:5px 10px;font-size:11px;';
      hadd.onclick=function(){
        var ne={id:_uuid(),name:'新条目',content:'',enabled:true};
        _sbS.wbEntries=(_sbS.wbEntries||[]);_sbS.wbEntries.push(ne);
        _sbS.wbActive=(_sbS.wbActive||[]);_sbS.wbActive.push(ne.id);
        _W();_renderTab();
      };
      hdr.appendChild(htitle);hdr.appendChild(hadd);
      f.appendChild(hdr);

      // ── ST pull button ─────────────────────────────────────
      var pullRow=TOPDOC.createElement('div');
      pullRow.style.cssText='margin-bottom:10px;';
      var pullBtn=_pbtn('从ST拉取世界书','green');
      pullBtn.style.cssText+='width:100%;padding:8px;font-size:12px;';
      pullBtn.onclick=function(){ _pullSTWb(); };
      pullRow.appendChild(pullBtn);
      f.appendChild(pullRow);

      var entries=_sbS.wbEntries||[];

      // ── Group ST entries by _stWbName ─────────────────────
      var stGroups={};
      var stGroupOrder=[];
      entries.forEach(function(e){
        if(!e._stWb) return;
        var gn=e._stWbName||'(未知世界书)';
        if(!stGroups[gn]){ stGroups[gn]=[]; stGroupOrder.push(gn); }
        stGroups[gn].push(e);
      });

      // Render each ST world book as a collapsible group
      stGroupOrder.forEach(function(gname){
        var gEntries=stGroups[gname];
        var collapsed=!!(_ui.wbCollapsed&&_ui.wbCollapsed[gname]);

        // Group container
        var grp=TOPDOC.createElement('div');
        grp.style.cssText='background:'+C.surface+';border-radius:14px;overflow:hidden;margin-bottom:8px;';

        // Group header
        var ghdr=TOPDOC.createElement('div');
        ghdr.style.cssText='display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;user-select:none;';
        ghdr.onclick=function(){
          if(!_ui.wbCollapsed) _ui.wbCollapsed={};
          _ui.wbCollapsed[gname]=!_ui.wbCollapsed[gname];
          _renderTab();
        };

        // Chevron
        var chev=TOPDOC.createElement('span');
        chev.style.cssText='font-size:11px;color:'+C.text2+';transition:transform .15s;transform:'+(collapsed?'rotate(-90deg)':'rotate(0deg)')+';flex-shrink:0;';
        chev.textContent='▾';

        // WB name
        var gnLabel=TOPDOC.createElement('span');
        gnLabel.style.cssText='font-size:12px;font-weight:600;color:'+C.text+';flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        gnLabel.textContent=gname;

        // Entry count badge
        var badge=TOPDOC.createElement('span');
        var enabledCnt=gEntries.filter(function(e){return e.enabled;}).length;
        badge.style.cssText='font-size:10px;color:'+C.text2+';background:rgba(255,255,255,.07);padding:1px 7px;border-radius:20px;flex-shrink:0;';
        badge.textContent=enabledCnt+'/'+gEntries.length;

        ghdr.appendChild(chev);ghdr.appendChild(gnLabel);

        // Group enable/disable toggle
        var grpDisabled=!!(_sbS.wbGroupDisabled&&_sbS.wbGroupDisabled[gname]);
        var grpTog=TOPDOC.createElement('button');
        grpTog.style.cssText='flex-shrink:0;width:32px;height:18px;border-radius:9px;border:none;cursor:pointer;transition:background .15s;background:'+(!grpDisabled?C.blue:'rgba(255,255,255,.15)')+';position:relative;margin-left:4px;';
        var grpKnob=TOPDOC.createElement('span');
        grpKnob.style.cssText='position:absolute;top:2px;width:14px;height:14px;border-radius:7px;background:#fff;transition:left .15s;left:'+(!grpDisabled?'15px':'2px')+';';
        grpTog.appendChild(grpKnob);
        (function(gn){
          grpTog.onclick=function(ev){
            ev.stopPropagation();
            _sbS.wbGroupDisabled=_sbS.wbGroupDisabled||{};
            _sbS.wbGroupDisabled[gn]=!_sbS.wbGroupDisabled[gn];
            _W();_renderTab();
          };
        })(gname);

        // Badge dims when group disabled
        badge.style.opacity=grpDisabled?'0.35':'1';
        gnLabel.style.opacity=grpDisabled?'0.4':'1';

        ghdr.appendChild(grpTog);ghdr.appendChild(badge);

        // Delete entire WB group button
        var delGrpBtn=_pbtn('删除','red');
        delGrpBtn.style.cssText+=';padding:3px 10px;font-size:11px;flex-shrink:0;margin-left:2px;';
        (function(gn){
          delGrpBtn.onclick=function(ev){
            ev.stopPropagation();
            _sbS.wbEntries=(_sbS.wbEntries||[]).filter(function(e){ return e._stWbName!==gn; });
            _sbS.wbActive=(_sbS.wbActive||[]).filter(function(id){
              return (_sbS.wbEntries||[]).some(function(e){ return e.id===id; });
            });
            if(_ui.wbCollapsed) delete _ui.wbCollapsed[gn];
            _W();_renderTab();
          };
        })(gname);
        ghdr.appendChild(delGrpBtn);
        grp.appendChild(ghdr);

        // Entries list (hidden when collapsed)
        if(!collapsed){
          var elist=TOPDOC.createElement('div');
          elist.style.cssText='border-top:1px solid rgba(255,255,255,.06);';

          gEntries.forEach(function(e,idx){
            var isEditing=(_ui.editPresetId===e.id);
            var row=TOPDOC.createElement('div');
            row.style.cssText='padding:8px 12px;'+(idx<gEntries.length-1?'border-bottom:1px solid rgba(255,255,255,.04);':'');

            if(isEditing){
              // Edit mode
              var nameIn=TOPDOC.createElement('input');
              nameIn.value=e.name;
              nameIn.placeholder='条目名称';
              nameIn.style.cssText='width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:'+C.text+';font-size:12px;padding:6px 8px;margin-bottom:6px;outline:none;';
              nameIn.oninput=function(){e.name=nameIn.value;_W();};
              var contentIn=TOPDOC.createElement('textarea');
              contentIn.value=e.content;
              contentIn.placeholder='条目内容';
              contentIn.style.cssText='width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:'+C.text+';font-size:12px;padding:6px 8px;min-height:72px;resize:vertical;outline:none;line-height:1.4;';
              contentIn.oninput=function(){e.content=contentIn.value;_W();};
              var doneBtn=_pbtn('完成','blue');
              doneBtn.style.cssText+='padding:5px 14px;font-size:11px;margin-top:4px;';
              doneBtn.onclick=function(){_ui.editPresetId=null;_W();_renderTab();};
              row.appendChild(nameIn);row.appendChild(contentIn);row.appendChild(doneBtn);
            } else {
              // View mode: toggle + name + edit + delete
              var topLine=TOPDOC.createElement('div');
              topLine.style.cssText='display:flex;align-items:center;gap:6px;';

              var tog=TOPDOC.createElement('button');
              tog.style.cssText='flex-shrink:0;width:32px;height:18px;border-radius:9px;border:none;cursor:pointer;transition:background .15s;background:'+(e.enabled?C.blue:'rgba(255,255,255,.15)')+';position:relative;';
              var knob=TOPDOC.createElement('span');
              knob.style.cssText='position:absolute;top:2px;width:14px;height:14px;border-radius:7px;background:#fff;transition:left .15s;left:'+(e.enabled?'15px':'2px')+';';
              tog.appendChild(knob);
              tog.onclick=function(){
                e.enabled=!e.enabled;
                _sbS.wbActive=(_sbS.wbActive||[]);
                if(e.enabled){ if(_sbS.wbActive.indexOf(e.id)<0) _sbS.wbActive.push(e.id); }
                else { _sbS.wbActive=_sbS.wbActive.filter(function(id){return id!==e.id;}); }
                _W();_renderTab();
              };

              var ename=TOPDOC.createElement('span');
              ename.style.cssText='flex:1;font-size:12px;color:'+C.text+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;';
              ename.textContent=e.name;
              ename.title=e.name;

              var editBtn=_pbtn('编辑','');
              editBtn.style.cssText+='padding:4px 10px;font-size:11px;flex-shrink:0;';
              (function(eid){ editBtn.onclick=function(){_ui.editPresetId=eid;_renderTab();}; })(e.id);

              var delBtn=_pbtn('删除','red');
              delBtn.style.cssText+='padding:4px 10px;font-size:11px;flex-shrink:0;';
              (function(eid){
                delBtn.onclick=function(){
                  _sbS.wbEntries=(_sbS.wbEntries||[]).filter(function(x){return x.id!==eid;});
                  _sbS.wbActive=(_sbS.wbActive||[]).filter(function(id){return id!==eid;});
                  _W();_renderTab();
                };
              })(e.id);

              topLine.appendChild(tog);topLine.appendChild(ename);topLine.appendChild(editBtn);topLine.appendChild(delBtn);
              row.appendChild(topLine);

              if(e.content){
                var previewWrap=TOPDOC.createElement('div');
                previewWrap.style.cssText='margin-top:5px;margin-left:40px;';
                var previewText=TOPDOC.createElement('div');
                previewText.style.cssText='font-size:11px;color:'+C.text2+';line-height:1.4;max-height:48px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;white-space:pre-wrap;word-break:break-all;';
                previewText.textContent=e.content;
                previewWrap.appendChild(previewText);
                row.appendChild(previewWrap);
              }
            }

            elist.appendChild(row);
          });

          grp.appendChild(elist);
        }

        f.appendChild(grp);
      });

      // ── Manual entries section ────────────────────────────
      var manualEntries=entries.filter(function(e){ return !e._stWb; });
      if(manualEntries.length){
        var mSection=TOPDOC.createElement('div');
        mSection.style.cssText='margin-top:4px;';

        var mTitle=TOPDOC.createElement('div');
        mTitle.style.cssText='font-size:11px;font-weight:600;color:'+C.text2+';letter-spacing:.3px;text-transform:uppercase;margin-bottom:6px;padding:0 2px;';
        mTitle.textContent='手动添加';
        mSection.appendChild(mTitle);

        manualEntries.forEach(function(e){
          var isEditing=(_ui.editPresetId===e.id);
          var card=TOPDOC.createElement('div');
          card.style.cssText='background:'+C.surface+';border-radius:12px;padding:10px 12px;margin-bottom:6px;';

          if(isEditing){
            // Edit mode
            var nameIn=TOPDOC.createElement('input');
            nameIn.value=e.name;
            nameIn.placeholder='条目名称';
            nameIn.style.cssText='width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:'+C.text+';font-size:12px;padding:6px 8px;margin-bottom:6px;outline:none;';
            nameIn.oninput=function(){e.name=nameIn.value;_W();};

            var contentIn=TOPDOC.createElement('textarea');
            contentIn.value=e.content;
            contentIn.placeholder='条目内容';
            contentIn.style.cssText='width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:'+C.text+';font-size:12px;padding:6px 8px;min-height:72px;resize:vertical;outline:none;line-height:1.4;';
            contentIn.oninput=function(){e.content=contentIn.value;_W();};

            var doneBtn=_pbtn('完成','blue');
            doneBtn.style.cssText+='padding:5px 14px;font-size:11px;margin-top:4px;';
            doneBtn.onclick=function(){_ui.editPresetId=null;_W();_renderTab();};

            card.appendChild(nameIn);card.appendChild(contentIn);card.appendChild(doneBtn);
          } else {
            // View mode
            var topLine=TOPDOC.createElement('div');
            topLine.style.cssText='display:flex;align-items:center;gap:8px;';

            var tog=TOPDOC.createElement('button');
            tog.style.cssText='flex-shrink:0;width:32px;height:18px;border-radius:9px;border:none;cursor:pointer;transition:background .15s;background:'+(e.enabled?C.blue:'rgba(255,255,255,.15)')+';position:relative;';
            var knob=TOPDOC.createElement('span');
            knob.style.cssText='position:absolute;top:2px;width:14px;height:14px;border-radius:7px;background:#fff;transition:left .15s;left:'+(e.enabled?'15px':'2px')+';';
            tog.appendChild(knob);
            tog.onclick=function(){
              e.enabled=!e.enabled;
              _sbS.wbActive=(_sbS.wbActive||[]);
              if(e.enabled){ if(_sbS.wbActive.indexOf(e.id)<0) _sbS.wbActive.push(e.id); }
              else { _sbS.wbActive=_sbS.wbActive.filter(function(id){return id!==e.id;}); }
              _W();_renderTab();
            };

            var ename=TOPDOC.createElement('span');
            ename.style.cssText='flex:1;font-size:12px;color:'+C.text+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            ename.textContent=e.name||'(未命名)';

            var editBtn=_pbtn('编辑','');
            editBtn.style.cssText+='padding:4px 10px;font-size:11px;';
            (function(eid){ editBtn.onclick=function(){_ui.editPresetId=eid;_renderTab();}; })(e.id);

            var delBtn=_pbtn('删除','red');
            delBtn.style.cssText+='padding:4px 10px;font-size:11px;';
            (function(eid){
              delBtn.onclick=function(){
                _sbS.wbEntries=(_sbS.wbEntries||[]).filter(function(x){return x.id!==eid;});
                _sbS.wbActive=(_sbS.wbActive||[]).filter(function(id){return id!==eid;});
                _W();_renderTab();
              };
            })(e.id);

            topLine.appendChild(tog);topLine.appendChild(ename);topLine.appendChild(editBtn);topLine.appendChild(delBtn);
            card.appendChild(topLine);

            if(e.content){
              var previewText=TOPDOC.createElement('div');
              previewText.style.cssText='margin-top:6px;font-size:11px;color:'+C.text2+';line-height:1.4;max-height:48px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;white-space:pre-wrap;word-break:break-all;';
              previewText.textContent=e.content;
              card.appendChild(previewText);
            }
          }

          mSection.appendChild(card);
        });

        f.appendChild(mSection);
      } else if(!stGroupOrder.length){
        // Empty state
        var empty=TOPDOC.createElement('div');
        empty.style.cssText='text-align:center;color:'+C.text2+';font-size:12px;padding:24px 0;';
        empty.textContent='暂无条目，点击「从ST拉取世界书」或「手动添加」';
        f.appendChild(empty);
      }

      var wrap=TOPDOC.createElement('div');wrap.appendChild(f);return wrap;
    }

    // ── ST Pull helpers ──────────────────────────────────
    function _getSTCtx(){
      try{ return TOP.SillyTavern&&TOP.SillyTavern.getContext?TOP.SillyTavern.getContext():null; }catch(e){ return null; }
    }
    // Pull user persona from ST into _sbS.user, then re-render
    function _pullSTUser(onDone){
      try{
        var ctx=_getSTCtx(); if(!ctx) throw new Error('无法访问 SillyTavern');
        var userName=ctx.name1||'';
        var fields=ctx.getCharacterCardFields?ctx.getCharacterCardFields():{};
        var persona=(fields&&fields.persona)||'';
        _sbS.user.name=userName; _sbS.user.persona=persona;
        _W(); if(onDone) onDone(); else { _renderTab(); _toast('✓ 用户人设已从酒馆拉取'); }
      }catch(e){ _toast('拉取失败: '+e.message); }
    }
    // Pull current ST character into _sbS.characters (updates existing ST entry or adds new)
    function _pullSTChar(){
      try{
        var ctx=_getSTCtx(); if(!ctx) throw new Error('无法访问 SillyTavern');
        var stChars=ctx.characters; var cid=ctx.characterId;
        if(stChars===undefined||cid===undefined||!stChars[cid]) throw new Error('未找到当前角色');
        var stC=stChars[cid];
        var fields=ctx.getCharacterCardFields?ctx.getCharacterCardFields():{};
        var charName=stC.name||'';
        var parts=[];
        if(fields.description&&fields.description.trim()) parts.push(fields.description.trim());
        if(fields.personality&&fields.personality.trim()) parts.push('[性格]\n'+fields.personality.trim());
        if(fields.scenario&&fields.scenario.trim()) parts.push('[场景]\n'+fields.scenario.trim());
        var charPersona=parts.join('\n\n');
        // Find existing ST-pulled char entry or create new
        var existing=null;
        for(var i=0;i<_sbS.characters.length;i++){
          if(_sbS.characters[i]._stChar){ existing=_sbS.characters[i]; break; }
        }
        if(existing){ existing.name=charName; existing.persona=charPersona; }
        else{
          var nc={id:_uuid(),name:charName,persona:charPersona,_stChar:true,ttsEnabled:false,ttsVoiceId:'',ttsLanguage:'',ttsSpeed:1.0};
          _sbS.characters.push(nc);
          if(_sbS.activeCharIds.indexOf(nc.id)<0) _sbS.activeCharIds.push(nc.id);
        }
        _W(); _renderTab(); _renderCharTabs();
        _toast('✓ 角色「'+charName+'」已从酒馆拉取');
      }catch(e){ _toast('拉取失败: '+e.message); }
    }
    // Pull active world book entries from ST extensionPrompts
    function _pullSTWb(){
      try{
        var ctx=_getSTCtx(); if(!ctx) throw new Error('无法访问 SillyTavern');
        // ── 1. 角色绑定的世界书
        var wbSet={};
        try{
          var ch=ctx.characters&&ctx.characterId!==undefined?ctx.characters[ctx.characterId]:null;
          if(ch){
            var cw=(ch.data&&ch.data.extensions&&ch.data.extensions.world)||ch.world||'';
            if(cw&&cw.trim()) wbSet[cw.trim()]=true;
          }
        }catch(e2){}
        // ── 2. 下拉框里被选中的世界书
        try{
          var sel=TOPDOC.querySelector('#world_info');
          if(sel){
            Array.from(sel.options).forEach(function(opt){
              if(opt.selected&&opt.text&&opt.value&&opt.value!=='') wbSet[opt.text]=true;
            });
          }
        }catch(e3){}
        var toLoad=Object.keys(wbSet);
        if(!toLoad.length){ _toast('当前无激活的世界书'); return; }
        _toast('正在拉取世界书…');
        var promises=toLoad.map(function(name){
          return Promise.resolve().then(function(){
            return ctx.loadWorldInfo(name);
          }).then(function(wb){ return {name:name,wb:wb}; });
        });
        Promise.all(promises).then(function(results){
          _sbS.wbEntries=(_sbS.wbEntries||[]).filter(function(e){ return !e._stWb; });
          _sbS.wbActive=(_sbS.wbActive||[]).filter(function(id){
            return _sbS.wbEntries.some(function(e){ return e.id===id; });
          });
          var totalEntries=0;
          results.forEach(function(r){
            if(!r||!r.wb||!r.wb.entries) return;
            if(_ui.wbCollapsed) delete _ui.wbCollapsed[r.name];
            Object.keys(r.wb.entries).sort(function(a,b){return parseInt(a)-parseInt(b);}).forEach(function(k){
              var e=r.wb.entries[k];
              var enabled=!e.disable;
              var ne={
                id:_uuid(),
                name:e.comment&&e.comment.trim()?e.comment.trim():('条目'+(totalEntries+1)),
                content:e.content||'',
                enabled:enabled,
                _stWb:true,
                _stWbName:r.name
              };
              _sbS.wbEntries.push(ne);
              if(enabled) _sbS.wbActive.push(ne.id);
              totalEntries++;
            });
          });
          _W(); _renderTab();
          _toast('✓ 已拉取 '+results.filter(function(r){return r&&r.wb;}).length+' 个世界书，共 '+totalEntries+' 条条目');
        }).catch(function(err){ _toast('拉取失败: '+(err&&err.message?err.message:String(err))); });
      }catch(e){ _toast('拉取失败: '+e.message); }
    }

    function _renderCharsTab(){
      function _makeAvatarWidget(getAv,setAv){
        var wrap=TOPDOC.createElement('div');
        wrap.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 12px 4px;';
        var img=TOPDOC.createElement('div');
        img.style.cssText='width:52px;height:52px;border-radius:50%;flex-shrink:0;overflow:hidden;'
          +'background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;'
          +'cursor:pointer;border:1.5px solid rgba(255,255,255,.15);transition:border-color .15s;';
        function _upd(){
          var av=getAv();
          if(av){img.style.backgroundImage='url('+av+')';img.style.backgroundSize='cover';img.style.backgroundPosition='center';img.innerHTML='';}
          else{img.style.backgroundImage='none';img.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.8" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';}
        }
        _upd();
        var info=TOPDOC.createElement('div');
        var lbl=TOPDOC.createElement('div');lbl.style.cssText='font-size:12px;color:rgba(255,255,255,.55);';lbl.textContent='头像';
        var hint=TOPDOC.createElement('div');hint.style.cssText='font-size:11px;color:rgba(255,255,255,.3);margin-top:2px;';hint.textContent='点击更换 · 仅本地存储';
        var fi=TOPDOC.createElement('input');fi.type='file';fi.accept='image/*';fi.style.display='none';
        fi.addEventListener('change',function(){
          var f=this.files&&this.files[0];if(!f)return;
          var r=new TOP.FileReader();
          r.onload=function(e){setAv(e.target.result);_W();_upd();};
          r.readAsDataURL(f);
        });
        img.addEventListener('mouseenter',function(){this.style.borderColor='rgba(255,255,255,.4)';});
        img.addEventListener('mouseleave',function(){this.style.borderColor='rgba(255,255,255,.15)';});
        img.addEventListener('click',function(e){e.stopPropagation();fi.click();});
        info.appendChild(lbl);info.appendChild(hint);
        wrap.appendChild(img);wrap.appendChild(info);wrap.appendChild(fi);
        return wrap;
      }

      var f=TOPDOC.createDocumentFragment();
      // User card
      var uc=TOPDOC.createElement('div');
      uc.style.cssText='background:'+C.surface+';border-radius:14px;overflow:hidden;';
      var uhr=TOPDOC.createElement('div');uhr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 12px 6px;';
      var _uHdAv=TOPDOC.createElement('div');
      _uHdAv.style.cssText='width:26px;height:26px;border-radius:50%;flex-shrink:0;margin-right:7px;background:rgba(255,255,255,.1);background-size:cover;background-position:center;';
      if(_sbS.user&&_sbS.user.avatar)_uHdAv.style.backgroundImage='url('+_sbS.user.avatar+')';
      else _uHdAv.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round" style="margin:6px auto;display:block;"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      var ulbl=TOPDOC.createElement('span');ulbl.style.cssText='font-size:12px;font-weight:600;color:'+C.text2+';display:flex;align-items:center;';
      ulbl.insertBefore&&ulbl.insertBefore(_uHdAv,ulbl.firstChild);
      ulbl.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:5px;opacity:.7;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>用户';
      var usB=_pbtn('保存','blue');
      var uPullB=_pbtn('从酒馆拉取','default');
      uPullB.title='从 SillyTavern 拉取当前用户人设';
      uPullB.addEventListener('click',function(e){
        e.stopPropagation();
        _pullSTUser(function(){
          // After pull, update the visible inputs in-place
          uNameI.value=_sbS.user.name;
          uPersT.value=_sbS.user.persona;
          _toast('✓ 用户人设已从酒馆拉取');
        });
      });
      var uBtns=TOPDOC.createElement('div');uBtns.style.cssText='display:flex;gap:5px;align-items:center;';
      uBtns.appendChild(uPullB);uBtns.appendChild(usB);
      uhr.appendChild(ulbl);uhr.appendChild(uBtns);uc.appendChild(uhr);
      /* User avatar */
      if(!_sbS.user)_sbS.user={name:'',persona:''};
      uc.appendChild(_makeAvatarWidget(function(){return _sbS.user.avatar;},function(v){_sbS.user.avatar=v;}));
      var _uavSep=TOPDOC.createElement('div');_uavSep.style.cssText='height:0.5px;background:rgba(255,255,255,.07);margin:0 12px;';uc.appendChild(_uavSep);
      var uep=TOPDOC.createElement('div');uep.style.cssText='padding:0 12px 10px;display:flex;flex-direction:column;gap:4px;';
      var uNameI=_inp('用户名','text',_sbS.user.name);
      var uPersT=_ta('用户人设',_sbS.user.persona,3);
      [_lbl('名字'),uNameI,_lbl('人设'),uPersT].forEach(function(el){uep.appendChild(el);});
      uc.appendChild(uep);
      usB.addEventListener('click',function(e){
        e.stopPropagation();_sbS.user.name=uNameI.value.trim();_sbS.user.persona=uPersT.value.trim();_W();_toast('用户信息已保存');
      });
      // User preset section
      var upSep=TOPDOC.createElement('div');upSep.style.cssText='height:0.5px;background:'+C.border+';margin:4px 12px 0;';uc.appendChild(upSep);
      var uph=TOPDOC.createElement('div');uph.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 12px 4px;';
      var uplbl=TOPDOC.createElement('span');uplbl.style.cssText='font-size:11px;color:'+C.text3+';letter-spacing:.4px;';uplbl.textContent='用户预设';
      var upnameI=_inp('预设名称','text','');upnameI.style.cssText+='padding:4px 8px;font-size:11px;border-radius:7px;';
      var upSaveB=_pbtn('保存','blue');
      upSaveB.addEventListener('click',function(e){
        e.stopPropagation();
        _sbS.user.name=uNameI.value.trim();_sbS.user.persona=uPersT.value.trim();
        var nm=upnameI.value.trim()||'预设'+((_sbS.userPresets.length)+1);
        _sbS.userPresets.push({id:_uuid(),name:nm,uname:_sbS.user.name,persona:_sbS.user.persona});
        _W();upnameI.value='';_renderTab();_toast('"'+nm+'" 已保存');
      });
      var uphR=TOPDOC.createElement('div');uphR.style.cssText='display:flex;gap:5px;align-items:center;';
      uphR.appendChild(upnameI);uphR.appendChild(upSaveB);
      uph.appendChild(uplbl);uph.appendChild(uphR);uc.appendChild(uph);
      if(_sbS.userPresets.length){
        var uplist=TOPDOC.createElement('div');uplist.style.cssText='padding:0 12px 10px;display:flex;flex-direction:column;gap:5px;';
        _sbS.userPresets.forEach(function(p,pi){
          var pr2=TOPDOC.createElement('div');pr2.style.cssText='display:flex;align-items:center;gap:5px;';
          var pn2=TOPDOC.createElement('span');pn2.style.cssText='flex:1;font-size:12px;color:'+C.text+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';pn2.textContent=p.name;
          var apB2=_pbtn('应用','default');
          apB2.addEventListener('click',function(e){
            e.stopPropagation();
            _sbS.user.name=p.uname;_sbS.user.persona=p.persona;
            uNameI.value=p.uname;uPersT.value=p.persona;
            _W();_toast('"'+p.name+'" 已应用');
          });
          var dlB2=_pbtn('删除','red');
          dlB2.addEventListener('click',function(e){
            e.stopPropagation();
            _sbS.userPresets.splice(pi,1);_W();_renderTab();_toast('已删除');
          });
          pr2.appendChild(pn2);pr2.appendChild(apB2);pr2.appendChild(dlB2);uplist.appendChild(pr2);
        });
        uc.appendChild(uplist);
      } else {
        var upe=TOPDOC.createElement('div');upe.style.cssText='font-size:11px;color:'+C.text3+';padding:2px 12px 10px;';upe.textContent='暂无预设';uc.appendChild(upe);
      }
      f.appendChild(_lbl('用户'));f.appendChild(uc);

      // Characters
      var chrHdr=_row();
      var chlbl=TOPDOC.createElement('span');chlbl.style.cssText='flex:1;font-size:11px;font-weight:600;color:'+C.text2+';letter-spacing:.5px;text-transform:uppercase;';chlbl.textContent='角色';
      var addB=_pbtn('+ 添加','blue');
      addB.addEventListener('click',function(e){
        e.stopPropagation();
        var nc={id:_uuid(),name:'',persona:'',ttsEnabled:false,ttsVoiceId:'',ttsLanguage:'',ttsSpeed:1.0};_sbS.characters.push(nc);
        _ui.editCharId=nc.id;_W();_renderTab();
      });
      chrHdr.appendChild(chlbl);chrHdr.appendChild(addB);

      var chrLbl=TOPDOC.createElement('div');chrLbl.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-top:12px;margin-bottom:5px;';
      var chPullB=_pbtn('从ST拉取','default');
      chPullB.title='从 SillyTavern 拉取当前角色卡';
      chPullB.addEventListener('click',function(e){ e.stopPropagation(); _pullSTChar(); });
      var chBtns=TOPDOC.createElement('div');chBtns.style.cssText='display:flex;gap:5px;';
      chBtns.appendChild(chPullB);chBtns.appendChild(addB);
      chrLbl.appendChild(chlbl);chrLbl.appendChild(chBtns);
      f.appendChild(chrLbl);

      if(!_sbS.characters.length){
        var em=TOPDOC.createElement('div');em.style.cssText='font-size:12px;color:'+C.text3+';padding:12px 0;text-align:center;';em.textContent='点击「+ 添加」创建角色';f.appendChild(em);
      }
      _sbS.characters.forEach(function(char){
        var isEdit=_ui.editCharId===char.id;
        var card=TOPDOC.createElement('div');
        card.style.cssText=
          'background:'+C.surface+';'
          +'border-radius:14px;overflow:hidden;margin-top:6px;'
          +'border:0.5px solid '+C.border+';';
        var ch=TOPDOC.createElement('div');ch.style.cssText='display:flex;align-items:center;gap:8px;padding:10px 12px;';
        var cn=TOPDOC.createElement('span');cn.style.cssText='flex:1;font-size:13px;color:'+C.text2+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';cn.textContent=char.name||'(未命名)';
        var ceB=_pbtn(isEdit?'收起':'编辑','default');
        ceB.addEventListener('click',function(e){e.stopPropagation();_ui.editCharId=isEdit?null:char.id;_renderTab();});
        var cdB=_pbtn('删除','red');
        cdB.addEventListener('click',function(e){
          e.stopPropagation();
          if(!TOP.confirm('删除角色 "'+char.name+'"？'))return;
          _sbS.characters=_sbS.characters.filter(function(c){return c.id!==char.id;});
          delete _sbS.history[char.id];_W();_renderTab();
        });
        var _chAv=TOPDOC.createElement('div');
        _chAv.style.cssText='width:32px;height:32px;border-radius:50%;flex-shrink:0;overflow:hidden;background:rgba(255,255,255,.08);background-size:cover;background-position:center;';
        if(char.avatar)_chAv.style.backgroundImage='url('+char.avatar+')';
        else _chAv.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        ch.insertBefore(_chAv,cn);
        ch.appendChild(cn);ch.appendChild(ceB);ch.appendChild(cdB);card.appendChild(ch);
        if(isEdit){
          var sep=TOPDOC.createElement('div');sep.style.cssText='height:0.5px;background:'+C.border+';margin:0 12px;';
          card.appendChild(sep);
          var ep=TOPDOC.createElement('div');ep.style.cssText='padding:4px 12px 12px;display:flex;flex-direction:column;gap:4px;';
          var cnI=_inp('角色名','text',char.name);
          var cpT=_ta('角色人设',char.persona,4);
          // ── TTS 设置 ──
          var ttsTogRow=TOPDOC.createElement('div');ttsTogRow.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:4px 0;';
          var ttsTogLbl=TOPDOC.createElement('span');ttsTogLbl.style.cssText='font-size:12px;color:'+C.text+';';ttsTogLbl.textContent='启用 TTS 语音';
          var ttsTogBtn=TOPDOC.createElement('button');
          ttsTogBtn.style.cssText='width:38px;height:20px;border-radius:10px;border:none;cursor:pointer;transition:background .2s;font-size:10px;font-weight:600;font-family:inherit;'
            +(char.ttsEnabled?'background:'+C.blue+';color:#fff;':'background:rgba(120,120,128,.25);color:'+C.text3+';');
          ttsTogBtn.textContent=char.ttsEnabled?'ON':'OFF';
          ttsTogBtn.addEventListener('click',function(e){
            e.stopPropagation();char.ttsEnabled=!char.ttsEnabled;
            ttsTogBtn.style.background=char.ttsEnabled?C.blue:'rgba(120,120,128,.25)';
            ttsTogBtn.style.color=char.ttsEnabled?'#fff':C.text3;
            ttsTogBtn.textContent=char.ttsEnabled?'ON':'OFF';
            ttsFields.style.display=char.ttsEnabled?'flex':'none';
            _W();
          });
          ttsTogRow.appendChild(ttsTogLbl);ttsTogRow.appendChild(ttsTogBtn);
          var ttsFields=TOPDOC.createElement('div');
          ttsFields.style.cssText='display:'+(char.ttsEnabled?'flex':'none')+';flex-direction:column;gap:4px;padding:4px 0 0;';
          var ttsVoiceI=_inp('自定义 Voice ID','text',char.ttsVoiceId||'');
          var ttsLangI=_inp('语言 (如 zh/en/ja, 留空自动)','text',char.ttsLanguage||'');
          var ttsSpeedRow=TOPDOC.createElement('div');ttsSpeedRow.style.cssText='display:flex;align-items:center;gap:6px;';
          var ttsSpeedLbl=TOPDOC.createElement('span');ttsSpeedLbl.style.cssText='font-size:12px;color:'+C.text2+';white-space:nowrap;';ttsSpeedLbl.textContent='语速';
          var ttsSpeedI=TOPDOC.createElement('input');ttsSpeedI.type='number';ttsSpeedI.step='0.1';ttsSpeedI.min='0.5';ttsSpeedI.max='2';
          ttsSpeedI.value=char.ttsSpeed!==undefined?char.ttsSpeed:1.0;
          ttsSpeedI.style.cssText='flex:1;padding:6px 10px;background:rgba(118,118,128,.18);border:none;border-radius:9px;color:'+C.text+';font-size:12px;outline:none;font-family:inherit;';
          ttsSpeedI.addEventListener('mousedown',function(e){e.stopPropagation();});
          ttsFields.appendChild(_lbl('Voice ID'));ttsFields.appendChild(ttsVoiceI);
          ttsFields.appendChild(_lbl('语言'));ttsFields.appendChild(ttsLangI);
          ttsSpeedRow.appendChild(ttsSpeedLbl);ttsSpeedRow.appendChild(ttsSpeedI);
          ttsFields.appendChild(ttsSpeedRow);
          var csB=_pbtn('保存','green');
          csB.addEventListener('click',function(e){
            e.stopPropagation();char.name=cnI.value.trim()||char.name;char.persona=cpT.value.trim();
            char.ttsVoiceId=ttsVoiceI.value.trim();char.ttsLanguage=ttsLangI.value.trim();
            char.ttsSpeed=parseFloat(ttsSpeedI.value)||1.0;
            _ui.editCharId=null;_W();_renderTab();_renderCharTabs();_toast('角色已保存');
          });
          var csr=_row();csr.appendChild(csB);
          var charAvWrap=_makeAvatarWidget(function(){return char.avatar;},function(v){char.avatar=v;});
          [charAvWrap,_lbl('名字'),cnI,_lbl('人设'),cpT,_lbl('MiniMax TTS'),ttsTogRow,ttsFields,csr].forEach(function(el){ep.appendChild(el);});
          card.appendChild(ep);
        }
        f.appendChild(card);
      });
      var wrap=TOPDOC.createElement('div');wrap.appendChild(f);return wrap;
    }

    function _renderTab(){
      _tabBody.innerHTML='';
      var c=(_ui.tab==='api')?_renderApiTab():(_ui.tab==='presets')?_renderPresetsTab():(_ui.tab==='chars')?_renderCharsTab():(_ui.tab==='phone')?_renderPhoneTab():_renderWbTab();
      _tabBody.appendChild(c);
      /* Also refresh phone UI — v9.25 buttons use stopPropagation so
         wrapLegacy's body-click listener never fires; _renderTab is the
         only reliable hook they all call after mutating state. */
      if(TOP._v8draw)TOP.setTimeout(TOP._v8draw,0);
    }

    // ── Character tab pills ───────────────────────────────
    var _charBar=TOPDOC.createElement('div');
    _charBar.style.cssText=
      'display:none;flex-shrink:0;padding:7px 12px;gap:6px;overflow-x:auto;'
      +'border-bottom:0.5px solid '+C.border+';scrollbar-width:thin;';
    function _renderCharTabs(){
      _charBar.innerHTML='';var ac=_ac();
      if(ac.length<=1){_charBar.style.display='none';return;}
      _charBar.style.display='flex';
      if(_ui.charIdx>=ac.length)_ui.charIdx=0;
      ac.forEach(function(char,i){
        var active=i===_ui.charIdx;
        var t=TOPDOC.createElement('button');
        t.style.cssText=
          'padding:5px 16px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;'
          +'font-family:inherit;white-space:nowrap;flex-shrink:0;transition:all .15s;border:none;'
          +(active
            ?'background:'+C.blueB+';color:'+C.blue+';box-shadow:0 0 0 1px '+C.blueB2+';'
            :'background:'+C.surface+';color:'+C.text2+';');
        t.textContent=char.name||'(未命名)';
        t.addEventListener('click',function(e){e.stopPropagation();_ui.charIdx=i;_renderCharTabs();_showCurrentChar();});
        _charBar.appendChild(t);
      });
      _renderInjectBar();
    }

    // ── Inject bar (character injection selection) ──────────
    var _injectBar=TOPDOC.createElement('div');
    _injectBar.style.cssText=
      'display:none;flex-shrink:0;padding:5px 12px 6px;'
      +'align-items:center;gap:6px;flex-wrap:wrap;'
      +'border-bottom:0.5px solid '+C.border+';';

    function _renderInjectBar(){
      _injectBar.innerHTML='';
      var ac=_ac();
      if(!ac.length){_injectBar.style.display='none';return;}
      _injectBar.style.display='flex';
      var lbl=TOPDOC.createElement('span');
      lbl.style.cssText='font-size:10px;font-weight:600;letter-spacing:.6px;color:'+C.text3+';text-transform:uppercase;white-space:nowrap;';
      lbl.textContent='注入发送';
      _injectBar.appendChild(lbl);
      ac.forEach(function(char){
        var isOn=_sbS.injectCharIds.indexOf(char.id)>=0;
        var pill=TOPDOC.createElement('button');
        pill.style.cssText=
          'padding:3px 10px;border-radius:12px;font-size:11px;font-weight:500;cursor:pointer;'
          +'font-family:inherit;white-space:nowrap;border:1px solid;transition:all .15s;'
          +(isOn
            ?'background:'+C.blueB+';color:'+C.blue+';border-color:'+C.blueB2+';'
            :'background:transparent;color:'+C.text3+';border-color:'+C.border2+';');
        pill.textContent=(isOn?'✓ ':'')+( char.name||'(未命名)');
        pill.addEventListener('click',function(e){
          e.stopPropagation();
          var idx=_sbS.injectCharIds.indexOf(char.id);
          if(idx>=0) _sbS.injectCharIds.splice(idx,1);
          else _sbS.injectCharIds.push(char.id);
          _W();_renderInjectBar();
        });
        _injectBar.appendChild(pill);
      });
    }

    // Set bridge function so Enter handler can read inject text
    _sbInjectFn=function(){
      var ids=_sbS.injectCharIds||[];
      if(!ids.length)return'';
      var parts=ids.map(function(id){
        var hist=_sbS.history[id];
        return(hist&&hist.length&&hist[0].raw)?hist[0].raw:'';
      }).filter(Boolean);
      return parts.join('');
    };

    // ── History nav bar ───────────────────────────────────
    var _histBar=TOPDOC.createElement('div');
    _histBar.style.cssText=
      'display:none;flex-shrink:0;padding:5px 12px;'
      +'align-items:center;justify-content:space-between;gap:6px;'
      +'border-bottom:0.5px solid '+C.border+';';
    function _histNavBtn(svgD){
      var b=TOPDOC.createElement('button');
      b.style.cssText=
        'width:24px;height:24px;border:none;background:transparent;cursor:pointer;'
        +'color:'+C.text2+';display:flex;align-items:center;justify-content:center;'
        +'border-radius:6px;transition:background .13s;padding:0;';
      b.innerHTML=_SVG(svgD,14);
      b.addEventListener('mouseenter',function(){this.style.background=C.surface2;});
      b.addEventListener('mouseleave',function(){this.style.background='transparent';});
      return b;
    }
    function _renderHistBar(charId){
      var hist=_sbS.history[charId]||[];
      if(hist.length<=1){_histBar.style.display='none';return;}
      _histBar.style.display='flex';_histBar.innerHTML='';
      var idx=_ui.histIdx[charId]||0;
      var pB=_histNavBtn('<polyline points="15 18 9 12 15 6"/>');
      pB.disabled=(idx>=hist.length-1);if(pB.disabled)pB.style.opacity='0.22';
      pB.title='更早一条';
      pB.addEventListener('click',function(e){e.stopPropagation();_ui.histIdx[charId]=(idx+1);_showCurrentChar();});
      var lbl=TOPDOC.createElement('span');lbl.style.cssText='flex:1;font-size:11px;color:'+C.text3+';text-align:center;letter-spacing:.3px;';
      lbl.textContent=(idx===0?'最新':'第'+(hist.length-idx)+'条')+' / 共'+hist.length+'条';
      var nB=_histNavBtn('<polyline points="9 18 15 12 9 6"/>');
      nB.disabled=(idx<=0);if(nB.disabled)nB.style.opacity='0.22';
      nB.title='更新一条';
      nB.addEventListener('click',function(e){e.stopPropagation();_ui.histIdx[charId]=Math.max(0,idx-1);_showCurrentChar();});
      _histBar.appendChild(pB);_histBar.appendChild(lbl);_histBar.appendChild(nB);
    }

    // ── Content iframe ────────────────────────────────────
    var _body=TOPDOC.createElement('div');
    _body.style.cssText='flex:1;overflow:hidden;position:relative;min-height:0;';
    var _frame=TOPDOC.createElement('iframe');
    _frame.style.cssText='width:100%;height:100%;border:none;background:transparent;display:block;';
    _frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups');
    _body.appendChild(_frame);
    var _emptyEl=TOPDOC.createElement('div');
    _emptyEl.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;pointer-events:none;';
    _emptyEl.innerHTML=
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="3"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
      +'<span style="font-size:12px;color:rgba(255,255,255,0.18);text-align:center;line-height:1.8;letter-spacing:.2px;">配置 API · 导入预设 · 添加角色<br>点击 ↺ 生成状态</span>';
    _body.appendChild(_emptyEl);

    // ── Resize handle ─────────────────────────────────────
    var _resH=TOPDOC.createElement('div');
    _resH.title='拖动调整大小';
    _resH.style.cssText='position:absolute;bottom:0;right:0;width:24px;height:24px;cursor:se-resize;z-index:10;display:flex;align-items:flex-end;justify-content:flex-end;padding:5px;opacity:0.22;';
    _resH.innerHTML='<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M8.5 0.5L0.5 8.5M8.5 4.5L4.5 8.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>';

    // ── Assemble ──────────────────────────────────────────
    var _phonePanel=_renderPhoneTab();
    var _homeBar=_phonePanel.querySelector('.vnm-homebar')||_phonePanel;
    var _homeBarPill=_phonePanel.querySelector('.vnm-homebar-pill');
    var _ppInner=_phonePanel.querySelector('#vnm-ph2');
    if(_ppInner){_ppInner.style.cssText='flex:1;display:flex;flex-direction:column;height:100%;border-radius:0;overflow:hidden;';}
    _phonePanel.style.cssText='flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;';
    [_phonePanel,_resH].forEach(function(el){_sb.appendChild(el);});
    overlay.appendChild(_sb);
        // Clamp SB position inside overlay (prevents off-screen in inline mode)
    TOP.setTimeout(function(){
      var _ow=overlay.offsetWidth||900;
      var _oh=overlay.offsetHeight||540;
      var _sw=_sb.offsetWidth||_sbS.size.w||350;
      var _sh=_sb.offsetHeight||_sbS.size.h||540;
      var _cx=Math.min(Math.max(10,_sbS.pos.x),Math.max(10,_ow-_sw-10));
      var _cy=Math.min(Math.max(10,_sbS.pos.y),Math.max(10,_oh-_sh-10));
      _sb.style.left=_cx+'px';
      _sb.style.top=_cy+'px';
    },80);
    _sb.addEventListener('click',    function(e){e.stopPropagation();});
    _sb.addEventListener('mousedown',function(e){e.stopPropagation();});
    _sb.addEventListener('mouseup',  function(e){e.stopPropagation();_onUp();});

    // ── Drag ─────────────────────────────────────────────
    var _dr=false,_dsx,_dsy,_dox,_doy;
    /* 拖动：点击面板顶部 40px 区域可拖拽 */
    _sb.addEventListener('mousedown',function(e){
      var rect=_sb.getBoundingClientRect();
      if(e.clientY-rect.top>40)return; /* 只响应顶部 40px */
      e.preventDefault();e.stopPropagation();
      _dr=true;_dsx=e.clientX;_dsy=e.clientY;
      _dox=parseInt(_sb.style.left)||0;_doy=parseInt(_sb.style.top)||0;
      _sb.style.cursor='grabbing';
    });
    var _rs=false,_rsx,_rsy,_row0,_roh;
    _resH.addEventListener('mousedown',function(e){
      e.preventDefault();e.stopPropagation();
      _rs=true;_rsx=e.clientX;_rsy=e.clientY;_row0=_sb.offsetWidth;_roh=_sb.offsetHeight;
    });
    function _onMove(e){
      if(_dr){
        var nx=Math.max(0,Math.min(TOP.innerWidth-_sb.offsetWidth,_dox+e.clientX-_dsx));
        var ny=Math.max(0,Math.min(TOP.innerHeight-_sb.offsetHeight,_doy+e.clientY-_dsy));
        _sb.style.left=nx+'px';_sb.style.top=ny+'px';
      }
      if(_rs){_sb.style.width=Math.max(280,_row0+e.clientX-_rsx)+'px';_sb.style.height=Math.max(200,_roh+e.clientY-_rsy)+'px';}
    }
    function _onUp(){
      if(_dr){_dr=false;_sbS.pos={x:parseInt(_sb.style.left),y:parseInt(_sb.style.top)};_W();
        _sb.style.cursor='';}
      if(_rs){_rs=false;_sbS.size={w:_sb.offsetWidth,h:_sb.offsetHeight};_W();}
    }
    TOPDOC.addEventListener('mousemove',_onMove);
    TOPDOC.addEventListener('mouseup',_onUp);

    // ── Settings toggle ───────────────────────────────────
    _settBtn.addEventListener('click',function(e){
      e.stopPropagation();_ui.settingsOpen=!_ui.settingsOpen;
      _settArea.style.display=_ui.settingsOpen?'flex':'none';
      if(_ui.settingsOpen){_setTab(_ui.tab);_renderTab();}
      _settBtn.style.background=_ui.settingsOpen?C.blueB:C.surface2;
      _settBtn.style.color=_ui.settingsOpen?C.blue:C.text2;
    });
    _closeBtn.addEventListener('click',function(e){
      e.stopPropagation();_sb.style.display='none';_sbS.visible=false;_W();
      var tb=overlay.querySelector('#vnm-btn-sb-toggle');
      if(tb){tb.style.color='rgba(255,255,255,.38)';tb.style.background='transparent';tb.style.borderColor='transparent';}
    });

    // ── Toast ─────────────────────────────────────────────
    function _toast(msg,dur){
      dur=dur||2400;
      var t=TOPDOC.createElement('div');
      t.style.cssText=
        'position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);'
        +'white-space:nowrap;padding:8px 20px;'
        +'background:rgba(28,28,32,0.96);border:0.5px solid rgba(255,255,255,0.12);'
        +'border-radius:22px;font-size:12px;font-weight:500;color:rgba(255,255,255,0.90);'
        +'pointer-events:none;z-index:9999;opacity:0;transition:opacity .20s;'
        +'box-shadow:0 8px 24px rgba(0,0,0,0.4);'
        +'font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
      t.textContent=msg;_sb.appendChild(t);
      setTimeout(function(){t.style.opacity='1';},16);
      setTimeout(function(){t.style.opacity='0';setTimeout(function(){if(t.parentNode)t.remove();},220);},dur);
    }
    function _updateTitle(){var p=_ap();_title.textContent=p?p.name.toUpperCase():'额外功能栏';}

    // ── Render helpers ────────────────────────────────────
    function _wrapDoc(body){return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow-x:hidden;}body{-webkit-font-smoothing:antialiased;}::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:10px;}::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.22);}scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.12) transparent;</style></head><body>'+body+'</body></html>';}
    function _showFrame(html){_emptyEl.style.display='none';_frame.srcdoc=_wrapDoc(html);}
    function _fallback(text){return '<div style="padding:16px;font-size:13px;color:rgba(200,200,210,0.80);white-space:pre-wrap;word-break:break-word;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">'+_esc(text)+'</div>';}
    function _parseAll(text){
      var p=_ap();
      if(!p||!p.regexPattern)return[p&&p.replacePattern?p.replacePattern:_fallback(text)];
      try{
        var re=new RegExp(p.regexPattern,'gs');
        var sre=new RegExp(p.regexPattern,'s');
        var results=[],m;
        while((m=re.exec(text))!==null)results.push(m[0].replace(sre,p.replacePattern));
        return results.length?results:['<div style="padding:16px;font-size:12px;color:rgba(255,255,255,0.6);font-family:-apple-system,sans-serif;">未匹配到状态块<br><br>'+_esc(text.substring(0,600))+'</div>'];
      }catch(e){return['<div style="padding:16px;font-size:12px;color:rgba(255,255,255,0.55);">正则错误: '+_esc(e.message)+'</div>'];}
    }
    function _showCurrentChar(){
      var ac=_ac();
      if(!ac.length){_emptyEl.style.display='';_frame.srcdoc='';return;}
      var idx=Math.min(_ui.charIdx,ac.length-1);
      var char=ac[idx];if(!char)return;
      _renderHistBar(char.id);
      var hist=_sbS.history[char.id]||[];
      var hIdx=_ui.histIdx[char.id]||0;
      if(hist.length&&hIdx<hist.length)_showFrame(hist[hIdx].html);
      else{_emptyEl.style.display='';_frame.srcdoc='';}
    }
    function _saveHist(charId,html,raw){
      if(!_sbS.history[charId])_sbS.history[charId]=[];
      _sbS.history[charId].unshift({ts:Date.now(),html:html,raw:raw.substring(0,2000)});
      var keep=Math.max(1,_sbS.historyKeep||10);
      _sbS.history[charId]=_sbS.history[charId].slice(0,keep);
      _ui.histIdx[charId]=0;_W();
    }
    function _getTurns(){
      var n=_sbS.turnCount||0;if(!n)return'';
      // Extract readable text from raw AI XML: find <content> blocks, strip <image> + tags
      function _extractContent(raw){
        if(!raw)return'';
        var out=[];
        var re=/<content[^>]*>([\s\S]*?)<\/content>/gi;
        var m;
        while((m=re.exec(raw))!==null){
          var chunk=m[1].replace(/<image>[\s\S]*?<\/image>/gi,'');
          chunk=chunk.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
          if(chunk)out.push(chunk);
        }
        if(out.length)return out.join(' ');
        return raw.replace(/<image>[\s\S]*?<\/image>/gi,'')
                  .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      }
      // Determine mesid of the current VNM iframe's message
      var currentMesId=-1;
      try{
        var curMes=getMyMesElement();
        if(curMes){
          var _mid=parseInt(curMes.getAttribute('mesid'),10);
          if(!isNaN(_mid))currentMesId=_mid;
        }
      }catch(e){}
      // ── SillyTavern chat array (preferred) ───────────────
      try{
        var stCtx=TOP.SillyTavern&&TOP.SillyTavern.getContext&&TOP.SillyTavern.getContext();
        var chatArr=stCtx&&stCtx.chat;
        if(chatArr&&chatArr.length){
          // Use mesid as upper bound; fall back to last-1 if unknown
          var bound=currentMesId>=0?currentMesId:chatArr.length-1;
          // Collect AI-only messages that come BEFORE the current message
          var aiMsgs=[];
          for(var _i=0;_i<bound;_i++){
            if(chatArr[_i]&&!chatArr[_i].is_user)aiMsgs.push(chatArr[_i]);
          }
          // slice(-n) = last n items = 最近 n 轮（倒着数）
          var hist=aiMsgs.slice(-n);
          if(!hist.length)return'';
          return hist.map(function(entry){
            var raw='';
            // mes may be VNM-processed HTML: try to find the embedded source script tag first
            var embMatch=(entry.mes||'').match(/<script[^>]+id=["']vnm-embedded-source["'][^>]*>([\s\S]*?)<\/script>/i);
            if(embMatch)raw=_extractContent(embMatch[1]);
            // Fall back to running _extractContent directly on mes (raw AI XML case)
            if(!raw)raw=_extractContent(entry.mes||'');
            // Last resort: strip all tags
            if(!raw)raw=(entry.mes||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
            return raw?'[角色]: '+raw:'';
          }).filter(Boolean).join('\n');
        }
      }catch(e){}
      // ── DOM fallback ──────────────────────────────────────
      var allMsgs=Array.from(TOPDOC.querySelectorAll('#chat .mes'));
      var aiDoms=allMsgs.filter(function(el){
        if(el.getAttribute('is_user')==='true')return false;
        if(currentMesId>=0){
          var elMid=parseInt(el.getAttribute('mesid'),10);
          return !isNaN(elMid)&&elMid<currentMesId;
        }
        return true;
      });
      // If mesid unknown, drop the last AI element (= current)
      if(currentMesId<0&&aiDoms.length)aiDoms=aiDoms.slice(0,-1);
      var domHist=aiDoms.slice(-n);
      if(!domHist.length)return'';
      return domHist.map(function(el){
        // Prefer vnm-embedded-source (raw AI content before VNM transform)
        var src=el.querySelector('#vnm-embedded-source');
        var txt=src?_extractContent(src.textContent.trim()):'';
        if(!txt){
          var mt=el.querySelector('.mes_text');
          if(mt){
            var tmp=TOPDOC.createElement('div');tmp.innerHTML=mt.innerHTML;
            tmp.querySelectorAll('script,style,iframe').forEach(function(s){s.remove();});
            txt=_extractContent(tmp.textContent.trim())||tmp.textContent.trim();
          }
        }
        return txt?'[角色]: '+txt:'';
      }).filter(Boolean).join('\n');
    }
    function _buildPrompt(activeChars,ctx){
      var p=_ap();if(!p)return'';
      var parts=[];
      if(_sbS.user.name||_sbS.user.persona)
        parts.push('[用户]\n名字: '+(_sbS.user.name||'未设置')+'\n人设: '+(_sbS.user.persona||'未设置'));
      if(activeChars.length){
        var cp=activeChars.map(function(c,i){
          var s='角色'+(i+1)+': '+(c.name||'未命名')+'\n人设: '+(c.persona||'未设置');
          var hist=(_sbS.history[c.id]||[]);
          var inj=Math.min(_sbS.historyInject||0,hist.length);
          if(inj>0){s+='\n  ('+c.name+'最近'+inj+'条状态历史):\n'+hist.slice(0,inj).reverse().map(function(h){return'  '+h.raw.substring(0,300);}).join('\n');}
          return s;
        });
        parts.push('[角色]\n'+cp.join('\n\n'));
      }
      if(_sbS.wbActive&&_sbS.wbActive.length&&_sbS.wbEntries&&_sbS.wbEntries.length){
        var wbParts=_sbS.wbEntries.filter(function(e){
            if(_sbS.wbActive.indexOf(e.id)<0) return false;
            if(e._stWbName&&_sbS.wbGroupDisabled&&_sbS.wbGroupDisabled[e._stWbName]) return false;
            return true;
          }).map(function(e){return'【'+e.name+'】\n'+e.content;}).join('\n\n');
        if(wbParts)parts.push('[世界书]\n'+wbParts);
      }
      var turns=_getTurns();if(turns)parts.push('[历史对话]\n'+turns);
      if(ctx)parts.push('[当前对话]\n'+ctx);
      if(activeChars.length>1)
        parts.push('[功能系统生成要求]\n请为以上'+activeChars.length+'个角色分别生成功能系统，每人一个完整状态块，按角色1、角色2…顺序输出。');
      return parts.join('\n\n');
    }
    function _setLoading(on){
      _refreshBtn.style.animation=on?'vnm-regen-spin 0.85s linear infinite':'';
      _refreshBtn.style.opacity=on?'0.50':'';_refreshBtn.style.pointerEvents=on?'none':'';
    }
    function _callApi(){
      if(_ui.loading)return;
      if(!_sbS.apiUrl){_toast('请先配置 API URL');_ui.settingsOpen=true;_settArea.style.display='flex';_setTab('api');_renderTab();return;}
      if(!_ap()){_toast('请先激活一个预设');_ui.settingsOpen=true;_settArea.style.display='flex';_setTab('presets');_renderTab();return;}
      var ac=_ac();
      var ctx='';try{ctx=getRawSource();}catch(e){}
      if(!ctx)ctx=state.sentences.map(function(s){return s.text;}).join('\n');
      // Strip <image>...</image> from USER context to avoid sending raw image data
      ctx=ctx.replace(/<image[\s\S]*?<\/image>/gi,'').replace(/[ \t]{2,}/g,' ').trim();
      var _sysP=_buildPrompt(ac,ctx);var _p=_ap();var _userP=(_p&&_p.promptSuffix)?_p.promptSuffix:ctx;_ui.lastPrompt={system:_sysP,user:_userP};var msgs=[{role:'system',content:_sysP},{role:'user',content:_userP}];
      var hdrs={'Content-Type':'application/json'};
      if(_sbS.apiKey)hdrs['Authorization']='Bearer '+_sbS.apiKey;
      _ui.loading=true;_setLoading(true);
      var _apiEp=_sbS.apiUrl.replace(/\/+$/,'');
      if(!_apiEp.match(/\/chat\/completions\/?$/))_apiEp=_apiEp+'/chat/completions';
      TOP.fetch(_apiEp,{method:'POST',headers:hdrs,body:JSON.stringify({model:_sbS.model||'gpt-4o',messages:msgs,stream:false})})
      .then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status+': '+t.substring(0,120));});return r.json();})
      .then(function(data){
        _ui.loading=false;_setLoading(false);
        var txt='';
        if(data.choices&&data.choices[0])txt=(data.choices[0].message&&data.choices[0].message.content)||data.choices[0].text||'';
        else if(typeof data.content==='string')txt=data.content;
        else if(Array.isArray(data.content))txt=data.content.map(function(c){return c.text||'';}).join('');
        else if(data.response)txt=data.response;
        else txt=JSON.stringify(data,null,2);
        var htmls=_parseAll(txt);
        if(ac.length>0){
          ac.forEach(function(char,i){_saveHist(char.id,htmls[i]||htmls[0]||'',txt);});
          _ui.charIdx=0;_ui.histIdx={};_renderCharTabs();
          if(ac[0])_renderHistBar(ac[0].id);
          _showFrame(htmls[0]||'');
        }else{_showFrame(htmls[0]||_fallback(txt));}
      })
      .catch(function(err){
        _ui.loading=false;_setLoading(false);
        var _em=err.message||String(err);
        var _hint='';
        if(_em==='Failed to fetch'||_em.indexOf('NetworkError')>=0||_em.indexOf('network')>=0){
          _hint='<br><br><b>常见原因：</b><br>① API地址不可达或填写错误<br>② HTTPS页面请求HTTP接口（混合内容被拦截）<br>③ CORS跨域——API服务器不允许请求<br>④ 服务未启动';
        }
        _showFrame('<div style="padding:20px;font-size:12px;color:rgba(255,255,255,0.55);font-family:-apple-system,sans-serif;line-height:1.8;">'+'<b>请求失败</b><br>'+_esc(_em)+_hint+'<br><br><span style="opacity:.6;font-size:11px;">请求地址: '+_esc(_apiEp)+'</span></div>');
      });
    }
    _refreshBtn.addEventListener('click',function(e){e.stopPropagation();_callApi();});

    // ── Toolbar toggle button (bind to static HTML element) ───
    (function(){
      var t=overlay.querySelector('#vnm-btn-sb-toggle');
      if(!t)return;
      function _sync(){
        t.style.color=_sbS.visible?'rgba(255,255,255,.92)':'rgba(255,255,255,.38)';
        t.style.background=_sbS.visible?'rgba(255,255,255,.12)':'transparent';
        t.style.borderColor=_sbS.visible?'rgba(255,255,255,.18)':'transparent';
      }
      t.addEventListener('click',function(e){e.stopPropagation();_sbS.visible=!_sbS.visible;_sb.style.display=_sbS.visible?'flex':'none';_sync();_W();});
      _sync();
    })();

    // ── Init ─────────────────────────────────────────────
    _updateTitle();_renderCharTabs();_renderInjectBar();_showCurrentChar();_setTab('api');try{_updatePluginInjection();}catch(e){}

    }catch(sbErr){console.warn('[VNM] statusbar init error:',sbErr.message,sbErr);}
  })();
  // ═══════════════════════════════════════════════════════
  // End Status Bar
  // ═══════════════════════════════════════════════════════

  // If jumping from a later turn (prevTurn), start at last sentence
  try{ if(TOP._vnmStartAtEnd){ state.idx=Math.max(0,state.sentences.length-1); TOP._vnmStartAtEnd=false; } }catch(e){}
  render();
  applySettings();
  applyStayModeUI();
  updateTurnCornerBtn();
  if (state.imageCount > 0 && state.myImgs.length < state.imageCount){
    console.log('[VNM v8.0] starting poll (have '+state.myImgs.length+'/'+state.imageCount+')...');
    startPolling();
  }
}

(function(){
  try{
    var _sm=TOP.localStorage.getItem('vnm-display-mode');
    if(_sm==='pc'||_sm==='mobile'||_sm==='web'){
      var _hmap={'pc':'vnm-btn-pc','mobile':'vnm-btn-mobile','web':'vnm-btn-web'};
      var _hb=document.getElementById(_hmap[_sm]);
      if(_hb) _hb.classList.add('vnm-lb-active');
    }
  }catch(e){}
})();
document.getElementById('vnm-btn-pc').addEventListener('click',function(){
  try{TOP.localStorage.setItem('vnm-display-mode','pc');}catch(e){}
  openViewer('pc');
});
document.getElementById('vnm-btn-mobile').addEventListener('click',function(){
  try{TOP.localStorage.setItem('vnm-display-mode','mobile');}catch(e){}
  openViewer('mobile');
});
document.getElementById('vnm-btn-web').addEventListener('click',function(){
  try{TOP.localStorage.setItem('vnm-display-mode','web');}catch(e){}
  openViewer('web');
});
document.getElementById('vnm-btn-full').addEventListener('click',function(){
  openViewer('fullscreen');
});
setTimeout(function(){
  try { injectImagePlaceholders(); } catch(e){ console.log('[VNM v8.0] placeholder err:', e.message); }
  // Auto-open only in the LAST VNM frame on the page (most recent message)
  try{
    var _autoMode=TOP.localStorage.getItem('vnm-display-mode');
    if(_autoMode==='pc'||_autoMode==='mobile'||_autoMode==='web'){
      var _isLast=(function(){
        try{
          var _frs=Array.from(TOPDOC.querySelectorAll('#chat .mes iframe'));
          var _vfrs=_frs.filter(function(fr){
            try{ var d=fr.contentDocument||fr.contentWindow.document;
              return d&&(d.getElementById('vnm-card')||d.getElementById('vnm-launch'));
            }catch(e){ return false; }
          });
          return _vfrs.length>0&&_vfrs[_vfrs.length-1]===window.frameElement;
        }catch(e){ return false; }
      })();
      if(_isLast) openViewer(_autoMode);
    }
  }catch(e){}
}, 400);
console.log('[VNM v8.0] ready');

// ── Cross-iframe mode sync via Storage API ──────────────────────────────
// The 'storage' event fires in every OTHER same-origin iframe when
// localStorage changes — perfect for real-time mode propagation.
window.addEventListener('storage', function(e){
  if(e.key !== 'vnm-display-mode') return;
  var newMode = e.newValue;
  if(newMode==='pc' || newMode==='mobile' || newMode==='web'){
    // Sync button highlights only — do NOT auto-open other frames
    // (only the directly-clicked frame opens; jumpToTurn navigates via direct btn.click)
    ['pc','mobile','web'].forEach(function(m){
      var b=document.getElementById('vnm-btn-'+m);
      if(b) b.classList.toggle('vnm-lb-active', m===newMode);
    });
  } else {
    // Mode cleared — remove highlights and close viewer if open
    ['pc','mobile','web'].forEach(function(m){
      var b=document.getElementById('vnm-btn-'+m);
      if(b) b.classList.remove('vnm-lb-active');
    });
    if(typeof window._vnmClose === 'function') window._vnmClose();
  }
});


try { window.__VNM_openViewer = openViewer; window.__VNM_app_ready = true; } catch(e){}
})();} catch(__vnmErr){ console.error("[VNM-Ext] app 初始化中断(入口仍可用):", __vnmErr); }

/* ============================================================================
 * Visual Novel (liquid glass) — SillyTavern 扩展引导
 * 由 build-extension.js 与 patched app.js 合并为 extension/index.js。
 *
 * 不依赖 <content> 正则。提供入口（扩展菜单项 + 保底悬浮按钮），
 * 点击后从 SillyTavern 上下文读取最近一条 AI 消息原文：
 *   有 <content> 取其中内容，否则取整条消息文本，交给阅读器渲染。
 * ========================================================================== */
(function () {
  'use strict';
  var ENTRY_ID = 'vnm-ext-entry';
  var FAB_ID = 'vnm-ext-fab';
  var LOG = '[VNM-Ext]';
  console.info(LOG, 'bootstrap loaded');

  function getCtx() {
    try { return (window.SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext() : null; }
    catch (e) { return null; }
  }

  function pickLatestAiText() {
    var ctx = getCtx();
    var chat = ctx && ctx.chat;
    if (!chat || !chat.length) return null;
    for (var i = chat.length - 1; i >= 0; i--) {
      var m = chat[i];
      if (!m || m.is_user || m.is_system) continue;
      var txt = (m.mes != null ? String(m.mes) : '');
      if (txt.trim()) return txt;
    }
    for (var j = chat.length - 1; j >= 0; j--) {
      var mm = chat[j];
      if (mm && mm.mes && String(mm.mes).trim()) return String(mm.mes);
    }
    return null;
  }

  function extractSource(text) {
    if (!text) return '';
    var re = /<content[^>]*>([\s\S]*?)<\/content>/gi;
    var parts = [], m;
    while ((m = re.exec(text)) !== null) parts.push(m[1]);
    return parts.length ? parts.join('\n\n') : text;
  }

  function openVN() {
    var text = pickLatestAiText();
    if (!text) { toast('没有可渲染的消息（先让 AI 回一条）'); return; }
    window.__VNM_SOURCE__ = extractSource(text);
    var mode = 'fullscreen';
    try { var saved = localStorage.getItem('vnm-display-mode'); if (saved) mode = saved; } catch (e) {}
    if (typeof window.__VNM_openViewer === 'function') {
      try { window.__VNM_openViewer(mode); }
      catch (e) { console.error(LOG, 'openViewer 失败', e); toast('打开阅读器失败：' + (e && e.message || e)); }
    } else {
      console.error(LOG, 'app 未就绪：window.__VNM_openViewer 不存在');
      toast('Visual Novel 运行时未就绪，请刷新页面重试');
    }
  }

  function toast(msg) {
    try { if (window.toastr) { window.toastr.info(msg, 'Visual Novel'); return; } } catch (e) {}
    console.info(LOG, msg);
  }

  // --- 入口 1: 扩展菜单项 ---
  function ensureMenuEntry() {
    var menu = document.getElementById('extensionsMenu') ||
               document.querySelector('#extensions_menu') ||
               document.querySelector('.extensions_block .list-group') ||
               document.querySelector('#rightSendForm #extensionsMenu') ||
               document.querySelector('.options-content');
    if (!menu) return false;
    if (menu.querySelector('#' + ENTRY_ID)) return true;
    var a = document.createElement('div');
    a.id = ENTRY_ID;
    a.className = 'list-group-item flex-container flexGap5 interactable';
    a.tabIndex = 0;
    a.title = '打开最近一条消息的视觉小说阅读器';
    a.innerHTML = '<div class="fa-solid fa-book-open extensionsMenuExtensionButton"></div><span>Visual Novel</span>';
    a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openVN(); });
    menu.appendChild(a);
    console.info(LOG, '扩展菜单入口已注入 ->', menu.id || menu.className);
    return true;
  }

  // --- 入口 2: 保底悬浮按钮（永远可用，可拖动）---
  function ensureFab() {
    if (document.getElementById(FAB_ID)) return;
    var b = document.createElement('button');
    b.id = FAB_ID;
    b.type = 'button';
    b.title = 'Visual Novel（点击打开，可拖动）';
    b.innerHTML = '🎴';
    b.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:120px', 'z-index:99999',
      'width:44px', 'height:44px', 'border-radius:50%', 'border:none',
      'font-size:20px', 'cursor:pointer',
      'background:rgba(30,30,40,0.72)', 'color:#fff',
      'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
      'backdrop-filter:blur(10px)', '-webkit-backdrop-filter:blur(10px)',
      'display:flex', 'align-items:center', 'justify-content:center'
    ].join(';');
    // 拖动支持
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    b.addEventListener('mousedown', function (e) {
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      var r = b.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      b.style.left = (ox + dx) + 'px'; b.style.top = (oy + dy) + 'px';
      b.style.right = 'auto'; b.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', function () { dragging = false; });
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (moved) { moved = false; return; }
      openVN();
    });
    document.body.appendChild(b);
    console.info(LOG, '保底悬浮按钮已添加');
  }


  // --- 入口 3: 扩展设置抽屉（标准 inline-drawer，出现在"扩展程序"面板里）---
  function ensureSettingsPanel() {
    var host = document.getElementById('extensions_settings') ||
               document.getElementById('extensions_settings2');
    if (!host) return false;
    if (document.getElementById('vnm-ext-drawer')) return true;
    var wrap = document.createElement('div');
    wrap.id = 'vnm-ext-drawer';
    wrap.innerHTML =
      '<div class="inline-drawer">' +
        '<div class="inline-drawer-toggle inline-drawer-header">' +
          '<b><span class="fa-solid fa-book-open" style="margin-right:6px"></span>Visual Novel</b>' +
          '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
        '</div>' +
        '<div class="inline-drawer-content">' +
          '<small style="opacity:.75">把最近一条 AI 消息渲染成视觉小说。无需 &lt;content&gt; 标签也可用。</small>' +
          '<div style="margin:8px 0;display:flex;align-items:center;gap:8px">' +
            '<label style="white-space:nowrap">显示模式</label>' +
            '<select id="vnm-ext-mode" class="text_pole" style="flex:1">' +
              '<option value="fullscreen">全屏</option>' +
              '<option value="web">网页全屏</option>' +
              '<option value="pc">PC 浮窗</option>' +
              '<option value="mobile">手机浮窗</option>' +
            '</select>' +
          '</div>' +
          '<div class="menu_button menu_button_icon interactable" id="vnm-ext-open" style="width:100%;justify-content:center">' +
            '<span class="fa-solid fa-play"></span><span>打开阅读器</span>' +
          '</div>' +
          '<label class="checkbox_label" style="margin-top:8px">' +
            '<input type="checkbox" id="vnm-ext-fab-toggle"><span>显示右下角悬浮按钮</span>' +
          '</label>' +
        '</div>' +
      '</div>';
    host.appendChild(wrap);

    // 抽屉展开/收起（兜底，万一酒馆没自动绑定）
    var toggle = wrap.querySelector('.inline-drawer-toggle');
    var content = wrap.querySelector('.inline-drawer-content');
    var icon = wrap.querySelector('.inline-drawer-icon');
    content.style.display = 'none';
    toggle.addEventListener('click', function () {
      var open = content.style.display === 'none';
      content.style.display = open ? '' : 'none';
      if (icon) { icon.classList.toggle('down', !open); icon.classList.toggle('up', open); }
    });

    // 模式选择记忆
    var sel = wrap.querySelector('#vnm-ext-mode');
    try { var sv = localStorage.getItem('vnm-display-mode'); if (sv) sel.value = sv; } catch (e) {}
    sel.addEventListener('change', function () {
      try { localStorage.setItem('vnm-display-mode', sel.value); } catch (e) {}
    });

    // 打开按钮
    wrap.querySelector('#vnm-ext-open').addEventListener('click', function () {
      try { localStorage.setItem('vnm-display-mode', sel.value); } catch (e) {}
      openVN();
    });

    // 悬浮按钮开关
    var fabChk = wrap.querySelector('#vnm-ext-fab-toggle');
    var fabPref = true;
    try { fabPref = localStorage.getItem('vnm-ext-fab') !== '0'; } catch (e) {}
    fabChk.checked = fabPref;
    applyFabPref(fabPref);
    fabChk.addEventListener('change', function () {
      try { localStorage.setItem('vnm-ext-fab', fabChk.checked ? '1' : '0'); } catch (e) {}
      applyFabPref(fabChk.checked);
    });

    console.info(LOG, '扩展设置抽屉已注入');
    return true;
  }

  function applyFabPref(show) {
    if (show) { ensureFab(); }
    else { var f = document.getElementById(FAB_ID); if (f) f.remove(); }
  }

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      ensureMenuEntry();
      ensureSettingsPanel();
      if (tries > 60) clearInterval(t);
    }, 500);
    ensureMenuEntry();
    ensureSettingsPanel();
    var fabPref = true;
    try { fabPref = localStorage.getItem('vnm-ext-fab') !== '0'; } catch (e) {}
    if (fabPref) ensureFab();
    window.VNM_Extension = { open: openVN, ensureMenuEntry: ensureMenuEntry, ensureSettingsPanel: ensureSettingsPanel, ensureFab: ensureFab };
    console.info(LOG, '就绪。控制台可用 VNM_Extension.open() 手动打开。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
