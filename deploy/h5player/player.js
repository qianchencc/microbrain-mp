(function () {
 'use strict';
 const q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
 const deviceId = q.get('deviceId'), source = q.get('source');
 const mode = q.get('mode') || 'live', beginTime = q.get('beginTime'), endTime = q.get('endTime');
 const playback = mode === 'playback';
 document.title = playback ? '录像回放' : '实时画面';
 const api = (q.get('api') || location.origin + '/micro-api/api/ai').replace(/\/$/, '');
 const token = q.get('token') || '', tenantCode = q.get('tenantCode') || '';
 const authorization = /^bearer\s/i.test(token) ? token : 'Bearer ' + token;
 const sdkPath = '/owner/static/h5player/';
 // 会话仅留在本页内存；刷新须从小程序重新进入，日志与浏览历史不留凭据。
 const clean = new URL(location.href);
 for (const key of ['token', 'url', 'timestamp']) clean.searchParams.delete(key);
 history.replaceState(null, '', clean);
 $('camName').textContent = q.get('name') || '监控画面';
 const localTime = value => { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time + 8 * 3600 * 1000).toISOString().slice(0,16).replace('T',' ') : ''; };
 $('camSub').textContent = playback ? `${localTime(beginTime)} — ${localTime(endTime)}` : (q.get('loc') ? q.get('loc') + ' · ' : '') + '实时预览';
 if (playback) { $('liveBadge').textContent = '录像'; $('liveBadge').classList.add('recorded'); $('btnRetry').textContent = '重新播放'; $('btnRelink').textContent = '重新播放'; }
 let state = 'boot', plugin = null, aborter = null, generation = 0, closed = false;
 let hideTimer, deadline, sdkPromise, stopping = Promise.resolve();
 const labels = { fetching: '取流中', connecting: '接入中', playing: playback ? '录像播放中' : '播放中', ended: '回放结束', failed: '不可用' };
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
  setState('fetching', playback ? '获取录像流地址' : '获取视频流地址');
  try {
   await stop();
   if (closed || current !== generation) return;
   if (!deviceId || !['office', 'company'].includes(source) || !token || !tenantCode) throw new Error('SESSION_REQUIRED');
   if (!['live', 'playback'].includes(mode) || (playback && (!Number.isFinite(Date.parse(beginTime)) || !Number.isFinite(Date.parse(endTime)) || Date.parse(endTime) <= Date.parse(beginTime) || Date.parse(endTime) - Date.parse(beginTime) > 3*86400000))) throw new Error('INVALID_VIDEO_WINDOW');
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
    $('footTime').textContent = playback ? '录像回放' : '实时预览'; setState('playing');
   }, StreamEnd: () => {
    if (closed || current !== generation) return;
    ++generation; void stop().catch(() => {});
    if (playback) setState('ended'); else fail('实时画面已中断，可以重试或返回');
   } });
   if (closed || current !== generation) return;
   aborter = new AbortController();
   deadline = setTimeout(() => { if (current === generation) { ++generation; void stop().catch(() => {}); fail('连接超时，可以重试或返回'); } }, 20000);
   const params = new URLSearchParams({ source, mode });
   if (playback) { params.set('beginTime', beginTime); params.set('endTime', endTime); }
   const response = await fetch(api + '/agent/devices/' + encodeURIComponent(deviceId) + '/video-stream?' + params,
    { headers: { Authorization: authorization, Tenantcode: tenantCode }, signal: aborter.signal, cache: 'no-store' });
   const stream = await response.json();
   if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'SESSION_REQUIRED' : stream.code || 'STREAM_UNAVAILABLE');
   if (playback && (stream.mode !== 'playback' || Date.parse(stream.beginTime) !== Date.parse(beginTime) || Date.parse(stream.endTime) !== Date.parse(endTime))) throw new Error('VIDEO_RECORDING_UNAVAILABLE');
   if (!stream.url) throw new Error('STREAM_UNAVAILABLE');
   if (closed || current !== generation) return;
   setState('connecting', '正在建立播放通道');
   if (playback) await instance.JS_Play(stream.url, { playURL: stream.url, mode: 1 }, 0, beginTime, endTime);
   else await instance.JS_Play(stream.url, { playURL: stream.url, mode: 0 }, 0);
   if (closed || current !== generation) { await release(instance).catch(() => {}); return; }
  } catch (error) {
   if (closed || current !== generation) return;
   ++generation;
   await stop().catch(() => {});
   fail(error.message === 'SESSION_REQUIRED' ? '会话或设备范围无法核验，请返回后重新进入' : error.message === 'SDK_UNAVAILABLE' ? '播放器组件未加载，请稍后重试'
    : error.message === 'INVALID_VIDEO_WINDOW' ? '录像窗口须有效，单次最多三天'
    : error.message === 'VIDEO_STREAM_BUSY' ? '上游取流暂不可用，请稍后重试'
    : error.message === 'VIDEO_RECORDING_UNAVAILABLE' ? '该窗口未取得可播放录像，请调整时间或稍后重试'
    : playback ? '录像连接或解码未完成，可以重试或返回' : undefined);
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
