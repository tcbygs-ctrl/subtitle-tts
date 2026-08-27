/**
 * pwa-app.js — PWA Application Logic
 */
(async function () {
  'use strict';

  // ─────────────────────────────────────────
  // State
  // ─────────────────────────────────────────
  let isActive       = false;
  let currentMode    = 'auto';
  let subtitles      = [];
  let selectedVoice  = null;
  let speechRate     = 1.0;
  let speechVol      = 1.0;
  let voices         = [];
  let observer       = null;
  let pollTimer      = null;
  let lastSpokenText = '';
  let currentSubId   = -1;
  let audioCtx       = null;
  let wakeLock       = null;

  const synth = window.speechSynthesis;

  // ─────────────────────────────────────────
  // Bookmarklet source (inline from file)
  // ─────────────────────────────────────────
  const BOOKMARKLET_CODE = `javascript:(function(){if(window.__STTS_RUNNING__){window.__STTS_PANEL__&&window.__STTS_PANEL__.toggle();return;}window.__STTS_RUNNING__=true;const synth=window.speechSynthesis;let selectedVoice=null,speechRate=1.0,isEnabled=false,observer=null,pollTimer=null,lastSpoken='',subtitles=[],currentId=-1,audioCtx=null,wakeLock=null;const PLATFORMS=[{name:'YouTube',host:'youtube.com',sel:'.ytp-caption-segment'},{name:'Netflix',host:'netflix.com',sel:'.player-timedtext'},{name:'AIS Play',host:'aisplay.co.th',sel:'.vjs-text-track-display'},{name:'True ID',host:'trueid.net',sel:'.vjs-text-track-display'},{name:'Mono Max',host:'monomax.com',sel:'.vjs-text-track-display'},{name:'WeTV',host:'wetv.vip',sel:'.subtitle-text'},{name:'Disney+',host:'disneyplus.com',sel:'[data-testid="subtitles"]'},{name:'Prime',host:'primevideo.com',sel:'.atvwebplayersdk-captions-overlay'}];function unlockAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}function log(m){const el=document.getElementById('stts-log');if(el)el.textContent=m;}function speak(text,rate){if(!isEnabled||!text.trim())return;if(text.trim()===lastSpoken)return;lastSpoken=text.trim();synth.cancel();const utt=new SpeechSynthesisUtterance(text.trim());if(selectedVoice)utt.voice=selectedVoice;utt.lang='th-TH';utt.rate=rate||speechRate;utt.volume=1.0;if(synth.paused)synth.resume();synth.speak(utt);const np=document.getElementById('stts-nowplaying');if(np)np.textContent=text.trim();}function findVideo(){return[...document.querySelectorAll('video')].sort((a,b)=>(b.paused?0:50)+(b.videoWidth||0)-((a.paused?0:50)+(a.videoWidth||0)))[0]||null;}function attachDOM(el,label){if(observer)observer.disconnect();observer=new MutationObserver(()=>{const t=el.textContent.replace(/\s+/g,' ').trim();if(t&&t!==lastSpoken&&t.length>1&&t.length<500){lastSpoken=t;speak(t);}});observer.observe(el,{childList:true,subtree:true,characterData:true});log('✅ '+label);}function detect(video){const host=location.hostname;const p=PLATFORMS.find(x=>x.host&&host.includes(x.host));if(video&&video.textTracks&&video.textTracks.length){const tracks=[...video.textTracks];const track=tracks.find(t=>t.mode==='showing')||tracks[0];if(track){track.mode='hidden';track.addEventListener('cuechange',()=>{const cues=[...(track.activeCues||[])];const text=cues.map(c=>c.text.replace(/<[^>]+>/g,'')).join(' ').trim();if(text)speak(text);});log('✅ TextTrack ('+track.language+')');return;}}if(p){const el=document.querySelector(p.sel);if(el){attachDOM(el,p.name);return;}}const sel='.vjs-text-track-display,.subtitle,.caption,[aria-live="polite"]';const el=document.querySelector(sel);if(el){attachDOM(el,'Generic');return;}log('⚠️ ไม่พบ Subtitle — เปิด Subtitle ในเว็บก่อน');}async function start(){unlockAudio();if('wakeLock'in navigator)try{wakeLock=await navigator.wakeLock.request('screen');}catch(e){}const video=findVideo();if(!video){log('⚠️ ไม่พบ Video');return;}detect(video);}function stop(){isEnabled=false;synth.cancel();if(pollTimer){clearInterval(pollTimer);pollTimer=null;}if(observer){observer.disconnect();observer=null;}if(wakeLock){wakeLock.release();wakeLock=null;}lastSpoken='';const np=document.getElementById('stts-nowplaying');if(np)np.textContent='—';}const panel=document.createElement('div');panel.id='stts-panel';panel.style.cssText='position:fixed;bottom:20px;right:16px;width:290px;background:rgba(10,12,22,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:14px;z-index:2147483647;font-family:-apple-system,sans-serif;color:#f0f2f8;box-shadow:0 20px 60px rgba(0,0,0,0.7);';panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:15px;">🔊</div><div><div style="font-size:12px;font-weight:700;">Subtitle TTS</div><div style="font-size:10px;color:#6b7280;">Universal v2</div></div></div><button id="stts-close" style="background:rgba(255,255,255,0.08);border:none;color:#aaa;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:11px;">✕</button></div><button id="stts-toggle" style="width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">▶ เริ่ม TTS</button><select id="stts-voice" style="width:100%;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#f0f2f8;font-size:11px;outline:none;margin-bottom:8px;"></select><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:10px;color:#6b7280;width:50px;">ความเร็ว</span><input id="stts-rate" type="range" min="0.5" max="2.0" step="0.1" value="1.0" style="flex:1;accent-color:#6366f1;"/><span id="stts-rate-v" style="font-size:10px;color:#a5b4fc;width:28px;">1.0×</span></div><div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:8px;min-height:36px;margin-bottom:8px;"><div style="font-size:9px;color:#4b5563;margin-bottom:2px;">กำลังอ่าน</div><div id="stts-nowplaying" style="font-size:11px;color:#c4b5fd;line-height:1.4;">—</div></div><div id="stts-log" style="font-size:10px;color:#4b5563;text-align:center;">พร้อมใช้งาน</div>';document.body.appendChild(panel);const voices=new Promise(res=>{const load=()=>{const v=synth.getVoices();if(v.length)res(v);};synth.onvoiceschanged=load;load();setTimeout(()=>res(synth.getVoices()),1500);});voices.then(vs=>{const thai=vs.filter(v=>v.lang.startsWith('th')||v.name.toLowerCase().includes('thai'));const list=thai.length?thai:vs.slice(0,10);const sel=document.getElementById('stts-voice');sel.innerHTML='';list.forEach((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent=v.name+' ('+v.lang+')';sel.appendChild(o);});if(list.length){selectedVoice=list[0];}sel.addEventListener('change',()=>{selectedVoice=list[+sel.value]||null;});});document.getElementById('stts-rate').addEventListener('input',function(){speechRate=+this.value;document.getElementById('stts-rate-v').textContent=speechRate.toFixed(1)+'×';});document.getElementById('stts-toggle').addEventListener('click',async()=>{unlockAudio();isEnabled=!isEnabled;const btn=document.getElementById('stts-toggle');if(isEnabled){btn.textContent='⏹ หยุด TTS';btn.style.background='linear-gradient(135deg,#dc2626,#b91c1c)';await start();}else{btn.textContent='▶ เริ่ม TTS';btn.style.background='linear-gradient(135deg,#6366f1,#8b5cf6)';stop();log('⏹ หยุดแล้ว');}});document.getElementById('stts-close').addEventListener('click',()=>{stop();window.__STTS_RUNNING__=false;panel.remove();});window.__STTS_PANEL__={toggle:()=>{panel.style.display=panel.style.display==='none'?'block':'none';}}; })();`;

  // Shortcut Script (ส่วนที่วางใน "Run JavaScript on Web Page")
  const SHORTCUT_CODE = `// Subtitle TTS — Apple Shortcut Script
// วางโค้ดนี้ใน Action "Run JavaScript on Web Page"
// ─────────────────────────────────────────

const synth = window.speechSynthesis;
let voice = synth.getVoices().find(v => v.lang.startsWith('th') || v.name.includes('Thai')) || null;

// หา Video element
const video = [...document.querySelectorAll('video')].sort((a,b) => (b.paused?0:50)+(b.videoWidth||0)-((a.paused?0:50)+(a.videoWidth||0)))[0];

// หา Subtitle element
function findSubtitle() {
  const host = location.hostname;
  if (host.includes('youtube.com')) {
    const track = [...(video?.textTracks||[])].find(t=>t.mode==='showing')||[...(video?.textTracks||[])][0];
    if (track) {
      track.mode = 'hidden';
      track.addEventListener('cuechange', () => {
        const text = [...(track.activeCues||[])].map(c=>c.text.replace(/<[^>]+>/g,'')).join(' ').trim();
        if (text) speak(text);
      });
      return 'TextTrack';
    }
  }
  const selectors = ['.player-timedtext','.vjs-text-track-display','.subtitle','.caption','[aria-live="polite"]'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) { watchElement(el); return sel; }
  }
  return null;
}

function speak(text) {
  if (!text.trim()) return;
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text.trim());
  if (voice) utt.voice = voice;
  utt.lang = 'th-TH'; utt.rate = 1.0;
  synth.speak(utt);
}

function watchElement(el) {
  let last = '';
  new MutationObserver(() => {
    const text = el.textContent.replace(/\\s+/g,' ').trim();
    if (text && text !== last && text.length > 1) { last = text; speak(text); }
  }).observe(el, {childList:true, subtree:true, characterData:true});
}

// ─── Run ───
const voices = await new Promise(r => {
  const v = synth.getVoices();
  if (v.length) r(v);
  else { synth.addEventListener('voiceschanged', () => r(synth.getVoices()), {once:true}); }
});
voice = voices.find(v => v.lang.startsWith('th') || v.name.toLowerCase().includes('thai')) || voices[0];

const method = findSubtitle();
completion(method ? 'Subtitle TTS เริ่มทำงาน: ' + method : 'ไม่พบ Subtitle — เปิด Subtitle ในเว็บก่อน');`;

  // ─────────────────────────────────────────
  // PWA Install Detection
  // ─────────────────────────────────────────
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isStandalone = ('standalone' in navigator) && navigator.standalone;

  if (isIOS && !isStandalone) {
    setTimeout(() => {
      document.getElementById('install-banner').classList.add('show');
    }, 3000);
  }

  // ─────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────
  window.showPage = function(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('active');
  };

  // ─────────────────────────────────────────
  // Load bookmarklet code
  // ─────────────────────────────────────────
  document.getElementById('bm-code').value  = BOOKMARKLET_CODE;
  document.getElementById('sc-code').value  = SHORTCUT_CODE;

  // ─────────────────────────────────────────
  // Copy helpers
  // ─────────────────────────────────────────
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  window.copyBM = function () {
    navigator.clipboard.writeText(BOOKMARKLET_CODE)
      .then(() => showToast('✅ คัดลอก Bookmarklet แล้ว!'))
      .catch(() => {
        document.getElementById('bm-code').select();
        document.execCommand('copy');
        showToast('✅ คัดลอกแล้ว!');
      });
  };

  window.copySC = function () {
    navigator.clipboard.writeText(SHORTCUT_CODE)
      .then(() => showToast('✅ คัดลอก Shortcut Script แล้ว!'))
      .catch(() => {
        document.getElementById('sc-code').select();
        document.execCommand('copy');
        showToast('✅ คัดลอกแล้ว!');
      });
  };

  window.dismissBanner = function () {
    showToast('💡 Share → Add to Home Screen');
    document.getElementById('install-banner').classList.remove('show');
  };

  // ─────────────────────────────────────────
  // TTS Engine (for in-page demo)
  // ─────────────────────────────────────────
  function unlockAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function loadVoices() {
    return new Promise(res => {
      const try_ = () => { voices = synth.getVoices(); if (voices.length) res(voices); };
      synth.addEventListener('voiceschanged', try_, { once: true });
      try_();
      setTimeout(() => { voices = synth.getVoices(); res(voices); }, 1500);
    });
  }

  function populateVoices(vs) {
    const thai   = vs.filter(v => v.lang.startsWith('th') || v.name.toLowerCase().includes('thai'));
    const others = vs.filter(v => !thai.includes(v)).slice(0, 15);
    const list   = [...thai, ...others];
    const sel    = document.getElementById('voice-select');
    sel.innerHTML = '';
    list.forEach((v, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = `${v.name} (${v.lang})`;
      sel.appendChild(o);
    });
    if (list.length) selectedVoice = list[0];
    sel.addEventListener('change', () => { selectedVoice = list[+sel.value] || null; });
  }

  function setStatus(type, title, method) {
    const dot = document.getElementById('status-dot');
    dot.className = 'status-dot ' + (type || '');
    document.getElementById('status-text').textContent = title;
    document.getElementById('status-method').textContent = method || '';
  }

  function setNowPlaying(text) {
    document.getElementById('now-playing').textContent = text || '—';
  }

  function speak(text, rate) {
    if (!isActive || !text.trim()) return;
    if (text.trim() === lastSpokenText) return;
    lastSpokenText = text.trim();
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text.trim());
    if (selectedVoice) utt.voice = selectedVoice;
    utt.lang   = 'th-TH';
    utt.rate   = rate || speechRate;
    utt.volume = speechVol;
    utt.pitch  = 1.0;
    utt.onerror = e => { if (e.error !== 'interrupted') console.warn('[TTS]', e.error); };
    if (synth.paused) synth.resume();
    synth.speak(utt);
    setNowPlaying(text.trim());
  }

  window.testSpeak = function () {
    unlockAudio();
    synth.cancel();
    const utt = new SpeechSynthesisUtterance('สวัสดีครับ นี่คือการทดสอบเสียง Subtitle TTS');
    if (selectedVoice) utt.voice = selectedVoice;
    utt.lang = 'th-TH'; utt.rate = speechRate; utt.volume = speechVol;
    if (synth.paused) synth.resume();
    synth.speak(utt);
  };

  window.rescan = function () {
    if (!isActive) return;
    setStatus('scanning', 'กำลังสแกนใหม่...', '');
    startDetection();
  };

  // ─────────────────────────────────────────
  // Toggle
  // ─────────────────────────────────────────
  document.getElementById('btn-toggle').addEventListener('click', async () => {
    unlockAudio();
    isActive = !isActive;

    if (isActive) {
      document.getElementById('btn-toggle').className = 'btn-main stop';
      document.getElementById('toggle-icon').textContent = '⏹';
      document.getElementById('toggle-text').textContent = 'หยุด TTS';
      setStatus('scanning', 'กำลังเริ่ม...', 'ตรวจหา Subtitle');

      if ('wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
      }

      if (currentMode === 'file' && subtitles.length) {
        startFileSync();
      } else {
        await startDetection();
      }

    } else {
      document.getElementById('btn-toggle').className = 'btn-main start';
      document.getElementById('toggle-icon').textContent = '▶';
      document.getElementById('toggle-text').textContent = 'เริ่ม TTS';
      synth.cancel();
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (observer)  { observer.disconnect(); observer = null; }
      if (wakeLock)  { wakeLock.release(); wakeLock = null; }
      lastSpokenText = ''; currentSubId = -1;
      setStatus('', 'พร้อมใช้งาน', 'กด "เริ่ม TTS" เพื่อเริ่มอ่านเสียง');
      setNowPlaying('—');
    }
  });

  // ─────────────────────────────────────────
  // Detection (for in-page video)
  // ─────────────────────────────────────────
  async function startDetection() {
    setStatus('scanning', 'กำลังตรวจ...', '');
    const video = [...document.querySelectorAll('video')].sort((a,b)=>(b.paused?0:50)+(b.videoWidth||0)-((a.paused?0:50)+(a.videoWidth||0)))[0];
    if (!video) {
      setStatus('error', 'ไม่พบ Video', 'เปิดหน้าวิดีโอก่อนกด Start');
      return;
    }

    // TextTrack
    const tracks = [...(video.textTracks||[])];
    const track = tracks.find(t=>t.mode==='showing') || tracks[0];
    if (track) {
      track.mode = 'hidden';
      track.addEventListener('cuechange', () => {
        const text = [...(track.activeCues||[])].map(c=>c.text.replace(/<[^>]+>/g,'')).join(' ').trim();
        if (text) speak(text);
      });
      setStatus('active', '✅ TextTrack', track.language || 'auto');
      return;
    }

    setStatus('error', 'ไม่พบ Subtitle', 'เปิด Subtitle ในเว็บก่อน หรือใช้ SRT/VTT');
  }

  async function startFileSync() {
    const video = document.querySelector('video');
    if (!video || !subtitles.length) return;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (!isActive) return;
      const t = video.currentTime;
      const sub = subtitles.find(s => t >= s.start && t < s.end);
      if (!sub || sub.id === currentSubId) return;
      currentSubId = sub.id;
      speak(sub.text);
    }, 200);
    setStatus('active', `✅ SRT/VTT Sync`, `${subtitles.length} ประโยค`);
  }

  // ─────────────────────────────────────────
  // Source tabs
  // ─────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      document.getElementById('file-area').style.display = currentMode === 'file' ? 'block' : 'none';
    });
  });

  // ─────────────────────────────────────────
  // File input
  // ─────────────────────────────────────────
  document.getElementById('file-label').addEventListener('click', () =>
    document.getElementById('file-input').click()
  );

  document.getElementById('file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    function toSec(t){const[h,m,s]=t.replace(',','.').split(':');return+h*3600+ +m*60+ +s;}
    const blocks = text.replace(/\r\n/g,'\n').trim().split(/\n\n+/);
    subtitles = blocks.reduce((acc,block)=>{
      const lines=block.split('\n').filter(l=>l.trim());
      const tl=lines.find(l=>l.includes('-->'));
      if(!tl)return acc;
      const m=tl.match(/(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})/);
      if(!m)return acc;
      const txt=lines.slice(lines.indexOf(tl)+1).join(' ').replace(/<[^>]+>/g,'').trim();
      if(txt)acc.push({id:acc.length,start:toSec(m[1]),end:toSec(m[2]),text:txt});
      return acc;
    },[]);
    document.getElementById('file-info').textContent = `✅ ${file.name} — ${subtitles.length} ประโยค`;
  });

  // ─────────────────────────────────────────
  // Sliders
  // ─────────────────────────────────────────
  document.getElementById('rate-slider').addEventListener('input', function() {
    speechRate = +this.value;
    document.getElementById('rate-val').textContent = speechRate.toFixed(1) + '×';
  });
  document.getElementById('vol-slider').addEventListener('input', function() {
    speechVol = +this.value;
    document.getElementById('vol-val').textContent = speechVol.toFixed(1);
  });

  // ─────────────────────────────────────────
  // Service Worker Registration
  // ─────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch(e) {
      console.log('[SW] Registration failed:', e);
    }
  }

  // ─────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────
  const allVoices = await loadVoices();
  populateVoices(allVoices);

})();
