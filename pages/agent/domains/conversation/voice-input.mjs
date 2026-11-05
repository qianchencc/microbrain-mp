// Retain the session through permission/start/stop callbacks so release cannot race start.
export function createVoiceInput({ getManager, onPhase, onResult, onError }) {
  let manager,
    active = false,
    started = false,
    released = false,
    cancelled = false;
  function finish() {
    active = false;
    onPhase('idle');
  }
  function fail(message) {
    const report = active && !cancelled;
    finish();
    if (report) onError(message);
  }
  function stop() {
    try {
      manager.stop();
    } catch {
      fail('录音未完成，请重新按住说话');
    }
  }
  return {
    start() {
      if (active) return false;
      try {
        manager = getManager();
      } catch {
        onError('当前版本暂未开通语音输入，请使用文字输入');
        return false;
      }
      active = true;
      started = false;
      released = false;
      cancelled = false;
      onPhase('starting');
      manager.onStart = () => {
        if (!active) return;
        started = true;
        if (released) stop();
        else onPhase('recording');
      };
      manager.onStop = (result) => {
        if (!active) return;
        const discard = cancelled;
        finish();
        const text = result.result?.trim();
        if (discard) return;
        if (text) onResult(text);
        else onError('没有听清，请重新按住说话');
      };
      manager.onError = () => fail('语音识别失败，请重试或使用文字输入');
      try {
        manager.start({ duration: 60000, lang: 'zh_CN' });
      } catch {
        fail('无法启动录音，请检查麦克风权限');
      }
      return active;
    },
    release(discard = false) {
      if (!active) return;
      cancelled ||= discard;
      if (released) return;
      released = true;
      onPhase(cancelled ? 'cancelling' : 'recognizing');
      if (started) stop();
    },
    dispose() {
      cancelled = true;
      if (active) {
        released = true;
        if (started) stop();
      }
      // Leave a pending onStart handler alive to stop recording after delayed permission.
    },
  };
}
