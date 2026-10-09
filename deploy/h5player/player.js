(function () {
 'use strict';
 const q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
 const deviceId = q.get('deviceId'), source = q.get('source');
 const api = (q.get('api') || location.origin + '/micro-api/api/ai').replace(/\/$/, '');
 const token = q.get('token') || '', tenantCode = q.get('tenantCode') || '';
 const authorization = /^bearer\s/i.test(token) ? token : 'Bearer ' + token;
 const sdkPath = '/owner/static/h5player/';
 // 会话仅留在本页内存；刷新须从小程序重新进入，日志与浏览历史不留凭据。
 const clean = new URL(location.href);
 for (const key of ['token', 'url', 'timestamp']) clean.searchParams.delete(key);
 history.replaceState(null, '', clean);
 $('camName').textContent = q.get('name') || '监控画面';
 $('camSub').textContent = (q.get('loc') ? q.get('loc') + ' · ' : '') + '实时预览';
 let state = 'boot', plugin = null, aborter = null, generation = 0, closed = false;
 let hideTimer, deadline, sdkPromise, stopping = Promise.resolve();
 const labels = { fetching: '取流中', connecting: '接入中', playing: '播放中', failed: '不可用' };
 function showChrome() { $('chromeTop').classList.remove('hidden'); $('chromeBottom').classList.remove('hidden'); }
 function scheduleHide() {
  clearTimeout(hideTimer);
  if (state === 'playing') hideTimer = setTimeout(() => { $('chromeTop').classList.add('hidden'); $('chromeBottom').classList.add('hidden'); }, 3200);
 }
 function setState(value, sub) {
  state = value;
  $('loadingView').classList.toggle('on', value === 'fetching' || value === 'connecting');
  $('errorView').classList.toggle('on', value === 'failed');
  $('liveBadge').classList.toggle('on', value === 'playing');
  $('footState').textContent = labels[value] || value;
  if (sub) $('stateSub').textContent = sub;
  if (value === 'playing') scheduleHide(); else showChrome();
 }
 function release(instance) {
  try { return Promise.resolve(instance?.JS_Stop()); } catch (error) { return Promise.reject(error); }
 }
 function stop() {
  aborter?.abort(); aborter = null;
  clearTimeout(hideTimer); clearTimeout(deadline);
  const instance = plugin; plugin = null;
  const previous = stopping;
  stopping = Promise.all([previous.catch(() => {}), release(instance)]).then(() => { if (!plugin) $('playWnd').innerHTML = ''; });
  return stopping;
 }
 function fail(message) {
  $('errTitle').textContent = '视频流暂时不可用';
  $('errSub').textContent = message || '请稍后重试，取流失败不代表摄像头离线';
  setState('failed');
 }
 function loadSdk() {
  if (typeof window.JSPlugin === 'function') return Promise.resolve();
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
   const script = document.createElement('script'); script.src = sdkPath + 'h5player.min.js';
   const timer = setTimeout(() => reject(new Error('SDK_UNAVAILABLE')), 15000);
   script.onload = () => { clearTimeout(timer); typeof window.JSPlugin === 'function' ? resolve() : reject(new Error('SDK_UNAVAILABLE')); };
   script.onerror = () => { clearTimeout(timer); reject(new Error('SDK_UNAVAILABLE')); };
   document.head.appendChild(script);
  }).catch(error => { sdkPromise = null; throw error; });
  return sdkPromise;
 }
 async function play() {
  const current = ++generation;
  setState('fetching', '获取视频流地址');
  try {
   await stop();
   if (closed || current !== generation) return;
   if (!deviceId || !['office', 'company'].includes(source) || !token || !tenantCode) throw new Error('SESSION_REQUIRED');
   await loadSdk();
   if (closed || current !== generation) return;
   const rect = document.querySelector('.stage-wrap').getBoundingClientRect();
   const height = Math.min(rect.height, rect.width * 9 / 16), width = height * 16 / 9;
   $('playWnd').style.width = Math.floor(width) + 'px'; $('playWnd').style.height = Math.floor(height) + 'px';
   const instance = new window.JSPlugin({ szId: 'playWnd', iWidth: Math.floor(width), iHeight: Math.floor(height), iMaxSplit: 1, iCurrentSplit: 1,
    szBasePath: sdkPath, oStyle: { borderWidth: 0, background: 'transparent' }, openDebug: false });
   plugin = instance;
   await instance.JS_SetWindowControlCallback({ firstFrameDisplay: (_index, frameWidth, frameHeight) => {
    if (closed || current !== generation) return;
    clearTimeout(deadline);
    $('playWnd').dataset.frameWidth = String(frameWidth); $('playWnd').dataset.frameHeight = String(frameHeight);
    $('footTime').textContent = '实时预览'; setState('playing');
   } });
   if (closed || current !== generation) return;
   aborter = new AbortController();
   deadline = setTimeout(() => { if (current === generation) { ++generation; void stop().catch(() => {}); fail('连接超时，可以重试或返回'); } }, 20000);
   const response = await fetch(api + '/agent/devices/' + encodeURIComponent(deviceId) + '/video-stream?source=' + source,
    { headers: { Authorization: authorization, Tenantcode: tenantCode }, signal: aborter.signal, cache: 'no-store' });
   if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'SESSION_REQUIRED' : 'STREAM_UNAVAILABLE');
   const stream = await response.json();
   if (!stream.url) throw new Error('STREAM_UNAVAILABLE');
   if (closed || current !== generation) return;
   setState('connecting', '正在建立播放通道');
   await instance.JS_Play(stream.url, { playURL: stream.url, mode: 0 }, 1);
   if (closed || current !== generation) { await release(instance).catch(() => {}); return; }
  } catch (error) {
   if (closed || current !== generation) return;
   ++generation;
   await stop().catch(() => {});
   fail(error.message === 'SESSION_REQUIRED' ? '会话或设备范围无法核验，请返回后重新进入' : error.message === 'SDK_UNAVAILABLE' ? '播放器组件未加载，请稍后重试' : undefined);
  }
 }
 document.querySelector('.stage-wrap').addEventListener('click', () => { showChrome(); scheduleHide(); });
 $('btnRetry').addEventListener('click', play); $('btnRelink').addEventListener('click', play);
 function close() { closed = true; ++generation; return stop().catch(() => {}); }
 async function back() {
  const stopped = close();
  $('footState').textContent = '正在结束播放';
  // 正常退出等待SDK释放；异常SDK不得无限阻塞用户返回。
  let timer;
  await Promise.race([stopped, new Promise(resolve => { timer = setTimeout(resolve, 1500); })]);
  clearTimeout(timer);
  if (window.wx?.miniProgram?.navigateBack) { window.wx.miniProgram.navigateBack(); return; }
  if (history.length > 1) history.back(); else { showChrome(); $('footState').textContent = '请使用微信返回或关闭此页'; }
 }
 $('btnBack').addEventListener('click', back); $('btnBack2').addEventListener('click', back);
 window.addEventListener('pagehide', close); window.addEventListener('beforeunload', close);
 document.addEventListener('visibilitychange', () => { if (document.hidden) close(); else if (closed) { closed = false; void play(); } });
 window.addEventListener('pageshow', event => { if (event.persisted) { closed = false; void play(); } });
 void play();
})();
