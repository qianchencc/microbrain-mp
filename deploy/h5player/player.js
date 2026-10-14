(function () {
 'use strict';
 const q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
 const deviceId = q.get('deviceId'), source = q.get('source');
 let mode = q.get('mode') || 'live', beginTime = q.get('beginTime'), endTime = q.get('endTime');
 let playback = mode === 'playback';
 const eventTime = Date.parse(q.get('eventTime'));
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
 // 客户SDK以北京时间钟面+Z定位录像；此标记仅用于SDK，不是业务/API的UTC时间。
 const sdkPlaybackTime = value => new Date(Date.parse(value) + 8 * 3600 * 1000).toISOString().slice(0,19) + 'Z';
 let state = 'boot', plugin = null, aborter = null, generation = 0, closed = false;
 let hideTimer, deadline, sdkPromise, clockTimer, stopping = Promise.resolve();
 let position = Date.parse(beginTime), rate = 1, dragging = false, controlBusy = false;
 let clockRead = 0, clockPending = 0;
 const controls = ['btnPause', 'btnEarlier', 'btnLater', 'playbackSeek', 'playbackSpeed', 'btnEvent'];
 function updateControls() {
  for (const id of controls) $(id).disabled = !playback || !plugin || controlBusy || !['playing', 'paused'].includes(state);
  $('btnMode').disabled = controlBusy;
  $('btnPause').textContent = state === 'paused' ? '继续' : '暂停';
  $('playbackSpeed').value = String(rate);
 }
 function configureMode() {
  document.title = playback ? '录像回放' : '实时画面';
  $('camSub').textContent = playback ? `${localTime(beginTime)} — ${localTime(endTime)}` : (q.get('loc') ? q.get('loc') + ' · ' : '') + '实时预览';
  $('liveBadge').textContent = playback ? '录像' : '直播'; $('liveBadge').classList.toggle('recorded', playback);
  $('btnRetry').textContent = $('btnRelink').textContent = playback ? '重新播放' : '重新连接';
  $('btnMode').textContent = playback ? '看直播' : '录像回放';
  $('playbackTimeline').hidden = !playback;
  for (const id of controls) $(id).hidden = !playback;
  const start = Date.parse(beginTime), end = Date.parse(endTime);
  const eventInside = Number.isFinite(eventTime) && eventTime >= start && eventTime < end;
  $('eventMark').hidden = $('btnEvent').hidden = !playback || !eventInside;
  if (eventInside) $('eventMark').style.left = `${(eventTime - start) / (end - start) * 100}%`;
  $('rangeStart').textContent = localTime(beginTime); $('rangeEnd').textContent = localTime(endTime);
  $('playbackSeek').max = String(Math.max(0, Math.floor((end - start) / 1000) - 1));
  position = start; renderPosition(start); updateControls();
 }
 function renderPosition(time) {
  if (!Number.isFinite(time)) return;
  $('playbackTime').textContent = new Date(time + 8 * 3600_000).toISOString().slice(11,19);
  $('playbackSeek').value = String(Math.max(0, (time - Date.parse(beginTime)) / 1000));
  $('playbackSeek').ariaValueText = localTime(new Date(time).toISOString());
 }
 async function readPosition(instance, current) {
  if (!playback || dragging || controlBusy || clockPending || !instance?.JS_GetOSDTime) return;
  const reading = ++clockRead; clockPending = reading;
  try {
   const time = await instance.JS_GetOSDTime(0);
   if (reading !== clockRead || instance !== plugin || current !== generation || dragging || controlBusy || closed) return;
   if (Number.isFinite(time) && time >= Date.parse(beginTime) && time <= Date.parse(endTime)) { position = time; renderPosition(time); }
  } catch { /* 暂时没有时间读数时保留最后一次，不能用墙钟模拟播放进度。 */ }
  finally { if (clockPending === reading) clockPending = 0; }
 }
 function showChrome() { $('chromeTop').classList.remove('hidden'); $('chromeBottom').classList.remove('hidden'); }
 function scheduleHide() {
  clearTimeout(hideTimer);
  if (state === 'playing' && !dragging && !controlBusy) hideTimer = setTimeout(() => { $('chromeTop').classList.add('hidden'); $('chromeBottom').classList.add('hidden'); }, 3200);
 }
 function setState(value, sub) {
  state = value;
  $('loadingView').classList.toggle('on', value === 'fetching' || value === 'connecting');
  $('errorView').classList.toggle('on', value === 'failed');
  $('liveBadge').classList.toggle('on', value === 'playing');
  $('footState').textContent = ({ fetching: '取流中', connecting: '接入中', playing: playback ? '录像播放中' : '播放中', paused: '已暂停', ended: '回放结束', failed: '不可用' })[value] || value;
  if (sub) $('stateSub').textContent = sub;
  updateControls();
  if (value === 'playing') scheduleHide(); else { clearTimeout(hideTimer); showChrome(); }
 }
 function release(instance) {
  try { return Promise.resolve(instance?.JS_Stop()); } catch (error) { return Promise.reject(error); }
 }
 function stop() {
  aborter?.abort(); aborter = null;
  clearTimeout(hideTimer); clearTimeout(deadline);
  clearInterval(clockTimer); clockTimer = null; ++clockRead; clockPending = 0; dragging = false; controlBusy = false; rate = 1;
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
   CONTROL_TIMEOUT: ['播放控制未完成', '本次控制未及时返回，已结束旧会话。请重新播放。'],
   RATE_CONTROL_FAILED: ['倍速切换未完成', '已结束旧会话，请重新播放恢复1倍速。'],
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
   const stage = document.querySelector('.stage-wrap'), rect = stage.getBoundingClientRect();
   const height = Math.min(stage.clientHeight || rect.height, (stage.clientWidth || rect.width) * 9 / 16), width = height * 16 / 9;
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
   if (playback) await instance.JS_Play(stream.url, { playURL: stream.url, mode: 1 }, 0, sdkPlaybackTime(beginTime), sdkPlaybackTime(endTime));
   else await instance.JS_Play(stream.url, { playURL: stream.url, mode: 0 }, 0);
   if (closed || current !== generation) { await release(instance).catch(() => {}); return; }
   if (playback) { void readPosition(instance, current); clockTimer = setInterval(() => { void readPosition(instance, current); }, 500); }
  } catch (error) {
   failAttempt(error);
  }
 }
 async function control(action, message) {
  if (!playback || controlBusy || !plugin || !['playing', 'paused'].includes(state)) return;
  const instance = plugin, current = generation;
  controlBusy = true; ++clockRead; clockPending = 0; clearTimeout(hideTimer); showChrome(); updateControls(); $('controlMessage').textContent = '正在处理…';
  let timer;
  try {
   await Promise.race([action(instance), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('CONTROL_TIMEOUT')), 8000); })]);
   if (current === generation && !closed) $('controlMessage').textContent = '';
  } catch (error) {
   if (current !== generation || closed) return;
   if (['CONTROL_TIMEOUT', 'RATE_CONTROL_FAILED'].includes(error?.message)) { ++generation; void stop().catch(() => {}); fail(failure(error, 'playing')); }
   else $('controlMessage').textContent = message;
  } finally {
   clearTimeout(timer);
   if (current === generation && !closed) { controlBusy = false; dragging = false; updateControls(); void readPosition(instance, current); scheduleHide(); }
  }
 }
 function seek(time) {
  const start = Date.parse(beginTime), end = Date.parse(endTime);
  const target = Math.max(start, Math.min(end - 1000, time));
  dragging = false;
  return control(async instance => { await instance.JS_Seek(0, sdkPlaybackTime(new Date(target).toISOString()), sdkPlaybackTime(endTime)); if (instance === plugin && !closed) setState('playing'); }, '定位失败，可调整时间后重试');
 }
 $('btnPause').addEventListener('click', () => control(async instance => {
  const paused = state === 'paused'; await (paused ? instance.JS_Resume(0) : instance.JS_Pause(0));
  if (instance === plugin && !closed) setState(paused ? 'playing' : 'paused');
 }, '暂停或继续失败，请重试'));
 $('playbackSeek').addEventListener('input', () => { dragging = true; clearTimeout(hideTimer); showChrome(); renderPosition(Date.parse(beginTime) + Number($('playbackSeek').value) * 1000); });
 $('playbackSeek').addEventListener('change', () => seek(Date.parse(beginTime) + Number($('playbackSeek').value) * 1000));
 $('playbackSeek').addEventListener('pointercancel', () => { dragging = false; renderPosition(position); scheduleHide(); });
 $('btnEarlier').addEventListener('click', () => seek(position - 15000));
 $('btnLater').addEventListener('click', () => seek(position + 15000));
 $('btnEvent').addEventListener('click', () => seek(eventTime));
 $('playbackSpeed').addEventListener('change', () => {
  const target = Number($('playbackSpeed').value);
  if (![0.5, 1, 2, 4, 8].includes(target)) return;
  return control(async instance => {
   while (rate !== target) {
    let value;
    try { value = await (rate < target ? instance.JS_Fast(0) : instance.JS_Slow(0)); }
    catch { throw new Error('RATE_CONTROL_FAILED'); } // SDK在服务端应答前改变倍速，失败后不能继续猜测档位。
    if (instance !== plugin || closed) return;
    if (!Number.isFinite(value) || value === 0) throw new Error('RATE_CONTROL_FAILED');
    rate = value < 0 ? 1 / Math.abs(value) : value;
   }
  }, '倍速切换失败，请重试');
 });
 $('btnMode').addEventListener('click', () => {
  if (controlBusy) return;
  playback = !playback; mode = playback ? 'playback' : 'live';
  if (playback && (!beginTime || !endTime)) { endTime = new Date().toISOString(); beginTime = new Date(Date.parse(endTime) - 30 * 60000).toISOString(); }
  $('controlMessage').textContent = ''; configureMode(); return play();
 });
 function resizeVideo() {
  const stage = document.querySelector('.stage-wrap'), rect = stage.getBoundingClientRect();
  const height = Math.min(stage.clientHeight || rect.height, (stage.clientWidth || rect.width) * 9 / 16), width = height * 16 / 9;
  $('playWnd').style.width = Math.floor(width) + 'px'; $('playWnd').style.height = Math.floor(height) + 'px';
  plugin?.JS_Resize?.(Math.floor(width), Math.floor(height))?.catch(() => {});
 }
 let wide = false;
 $('btnFullscreen').addEventListener('click', async () => {
  const page = document.querySelector('.page');
  try {
   if (document.fullscreenElement) { await document.exitFullscreen(); $('btnFullscreen').textContent = '全屏'; resizeVideo(); }
   else if (page.requestFullscreen) { await page.requestFullscreen(); $('btnFullscreen').textContent = '退出全屏'; resizeVideo(); }
   else { wide = !wide; page.classList.toggle('wide', wide); $('btnFullscreen').textContent = wide ? '退出全屏' : '全屏'; resizeVideo(); }
  } catch { wide = !wide; page.classList.toggle('wide', wide); $('btnFullscreen').textContent = wide ? '退出全屏' : '全屏'; resizeVideo(); }
 });
 document.addEventListener('fullscreenchange', () => { $('btnFullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏'; resizeVideo(); });
 window.addEventListener('resize', resizeVideo);
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
 configureMode(); void play();
})();
