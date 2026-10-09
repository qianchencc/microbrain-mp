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
 function failure(cause, phase, detail, httpStatus) {
  // SDK可能直接拒绝一个字符串错误码；只保留可公开的码和状态，不展示原始消息/流地址。
  const raw = typeof cause === 'string' || typeof cause === 'number' ? String(cause) : cause?.message;
  const code = /^(?:0[xX][0-9a-fA-F]{1,12}|[A-Z][A-Z0-9_]{0,60}|\d{1,12})$/.test(raw || '') ? (/^0x/i.test(raw) ? raw.toLowerCase() : raw) : '';
  const status = key => /^(?:[\w .-]{1,60})$/.test(String(detail?.[key] ?? '')) ? String(detail[key]) : '';
  let title = phase === 'playing' ? '播放已中断' : '播放未能开始';
  let message = '播放器未能显示画面，可以重试或返回。';
  let stage = ({ session: '检查会话和期间', sdk: '加载播放器', fetching: '申请播放地址', response: '读取取流响应', connecting: '建立播放通道', playing: '播放视频流' })[phase];
  const fetching = phase === 'fetching' || phase === 'response';
  const known = {
   SESSION_REQUIRED: ['会话或设备范围无法核验', '请返回原页面后重新进入播放器。'],
   INVALID_VIDEO_WINDOW: ['录像期间无效', '结束须晚于开始，单次最多三天。请返回调整期间。'],
   SDK_UNAVAILABLE: ['播放器组件未加载', '播放器资源未能加载，请检查网络后重试。'],
   VIDEO_STREAM_BUSY: ['上游取流暂不可用', '上游暂未提供播放地址，请稍后重试。'],
   VIDEO_RECORDING_UNAVAILABLE: ['未取得可播放录像', '所选窗口未取得播放地址，可调整期间或稍后重试；录像是否存在仍需平台核实。'],
   VIDEO_WINDOW_MISMATCH: ['录像窗口核验未通过', '返回的录像窗口与所选期间不一致，已停止播放。请返回重新选择。'],
   STREAM_UNAVAILABLE: ['未取得播放地址', '本次未返回可用播放地址，可以重试；取流失败不代表摄像头离线。'],
   VIDEO_STREAM_UNAVAILABLE: ['视频取流暂不可用', '取流服务未能提供播放地址，请稍后重试或返回。'],
   TIMEOUT: [fetching ? '取流请求超时' : '等待视频画面超时', fetching ? '取流请求未在20秒内完成，可以重试或返回。' : '未在20秒内显示视频首帧，可以重试或返回。'],
   STREAM_ENDED: ['实时画面已中断', '播放通道已结束，可以重新连接或返回。'],
  };
  if (known[code]) [title, message] = known[code];
  else if (status('subStatusCode') === 'server') {
   title = phase === 'playing' ? '上游视频服务中断了播放' : playback ? '上游录像服务未能开始播放' : '上游视频服务未能开始播放';
   message = '上游媒体服务返回错误。可重试；持续失败请提供下方错误详情排查。';
   stage = phase === 'playing' ? '上游播放' : '上游开始播放';
  } else if (['0x12f910000', '0x12f910015', '0x12f910016', '0x12f910018', '0x12f910019', '0x12f910023'].includes(code)) {
   title = '视频播放通道未能建立'; message = '播放器报告连接失败或超时，可以重试或返回。';
  } else if (['0x12f910026', '0x12f910032', '0x12f910033'].includes(code) || code.startsWith('0x12f92400')) {
   title = '播放器无法处理视频流'; message = '播放器报告视频编码或解码错误。可重试；持续失败请提供错误码排查。'; stage = '处理视频流';
  } else if (phase === 'sdk') { title = '播放器初始化失败'; message = '播放器组件未能就绪，请重试或返回。'; }
  else if (phase === 'fetching') { title = '无法连接取流服务'; message = '取流请求未能完成，请检查网络后重试或返回。'; }
  else if (phase === 'response') { title = '取流服务响应异常'; message = '未收到可识别的播放响应，请稍后重试。'; }
  return { title, message, detail: [
   `失败阶段：${stage}`, `错误码：${code || '未提供'}`, httpStatus ? `取流 HTTP：${httpStatus}` : '',
   ...['statusCode', 'statusString', 'subStatusCode'].map(key => status(key) ? `${key}：${status(key)}` : ''),
   `设备：${q.get('name') || deviceId || '未提供'}`, `来源：${source === 'company' ? 'Company' : 'Office'}`, `模式：${playback ? '录像回放' : '实时观看'}`,
   playback ? `期间：${localTime(beginTime)} — ${localTime(endTime)}（上海时间）` : '', `发生时间：${localTime(new Date().toISOString())}（上海时间）`,
  ].filter(Boolean).join('\n') };
 }
 function fail(result) {
  $('errTitle').textContent = result.title;
  $('errSub').textContent = result.message;
  $('errDetail').textContent = result.detail;
  $('errDetails').open = false;
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
  let phase = 'session', httpStatus = 0;
  const failAttempt = (cause, detail) => {
   if (closed || current !== generation) return;
   const result = failure(cause, phase, detail, httpStatus);
   ++generation; void stop().catch(() => {}); fail(result);
  };
  setState('fetching', playback ? '获取录像流地址' : '获取视频流地址');
  try {
   await stop();
   if (closed || current !== generation) return;
   if (!deviceId || !['office', 'company'].includes(source) || !token || !tenantCode) throw new Error('SESSION_REQUIRED');
   if (!['live', 'playback'].includes(mode) || (playback && (!Number.isFinite(Date.parse(beginTime)) || !Number.isFinite(Date.parse(endTime)) || Date.parse(endTime) <= Date.parse(beginTime) || Date.parse(endTime) - Date.parse(beginTime) > 3*86400000))) throw new Error('INVALID_VIDEO_WINDOW');
   phase = 'sdk'; await loadSdk();
   if (closed || current !== generation) return;
   const rect = document.querySelector('.stage-wrap').getBoundingClientRect();
   const height = Math.min(rect.height, rect.width * 9 / 16), width = height * 16 / 9;
   $('playWnd').style.width = Math.floor(width) + 'px'; $('playWnd').style.height = Math.floor(height) + 'px';
   const instance = new window.JSPlugin({ szId: 'playWnd', iWidth: Math.floor(width), iHeight: Math.floor(height), iMaxSplit: 1, iCurrentSplit: 1,
    szBasePath: sdkPath, oStyle: { borderWidth: 0, background: 'transparent' }, openDebug: false });
   plugin = instance;
   await instance.JS_SetWindowControlCallback({ pluginErrorHandler: (_index, code, detail) => failAttempt(code, detail), firstFrameDisplay: (_index, frameWidth, frameHeight) => {
    if (closed || current !== generation) return;
    phase = 'playing';
    clearTimeout(deadline);
    $('playWnd').dataset.frameWidth = String(frameWidth); $('playWnd').dataset.frameHeight = String(frameHeight);
    $('footTime').textContent = playback ? '录像回放' : '实时预览'; setState('playing');
   }, StreamEnd: () => {
    if (closed || current !== generation) return;
    if (playback) { ++generation; void stop().catch(() => {}); setState('ended'); }
    else failAttempt('STREAM_ENDED');
   } });
   if (closed || current !== generation) return;
   aborter = new AbortController();
   phase = 'fetching';
   deadline = setTimeout(() => failAttempt('TIMEOUT'), 20000);
   const params = new URLSearchParams({ source, mode });
   if (playback) { params.set('beginTime', beginTime); params.set('endTime', endTime); }
   const response = await fetch(api + '/agent/devices/' + encodeURIComponent(deviceId) + '/video-stream?' + params,
    { headers: { Authorization: authorization, Tenantcode: tenantCode }, signal: aborter.signal, cache: 'no-store' });
   httpStatus = response.status || 0;
   if (httpStatus === 401 || httpStatus === 403) throw new Error('SESSION_REQUIRED');
   phase = 'response'; const stream = await response.json();
   if (!stream || typeof stream !== 'object' || Array.isArray(stream)) throw new Error('INVALID_STREAM_RESPONSE');
   phase = 'fetching';
   if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'SESSION_REQUIRED' : stream.code || 'STREAM_UNAVAILABLE');
   if (playback && (stream.mode !== 'playback' || Date.parse(stream.beginTime) !== Date.parse(beginTime) || Date.parse(stream.endTime) !== Date.parse(endTime))) throw new Error('VIDEO_WINDOW_MISMATCH');
   if (!stream.url) throw new Error('STREAM_UNAVAILABLE');
   if (closed || current !== generation) return;
   setState('connecting', '正在建立播放通道');
   phase = 'connecting';
   if (playback) await instance.JS_Play(stream.url, { playURL: stream.url, mode: 1 }, 0, beginTime, endTime);
   else await instance.JS_Play(stream.url, { playURL: stream.url, mode: 0 }, 0);
   if (closed || current !== generation) { await release(instance).catch(() => {}); return; }
  } catch (error) {
   failAttempt(error);
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
