export function createNdjsonStreamDecoder(onEvent) {
  let pendingBytes = new Uint8Array(0);
  let pendingText = '';
  let ended = false;

  const decode = (buffer, final) => {
    const incoming = buffer ? new Uint8Array(buffer) : new Uint8Array(0);
    const bytes = new Uint8Array(pendingBytes.length + incoming.length);
    bytes.set(pendingBytes);
    bytes.set(incoming, pendingBytes.length);
    pendingBytes = new Uint8Array(0);

    let text = '';
    let index = 0;
    while (index < bytes.length) {
      const first = bytes[index];
      if (first < 0x80) {
        text += String.fromCodePoint(first);
        index += 1;
        continue;
      }

      const width = first >= 0xf0 ? 4 : first >= 0xe0 ? 3 : first >= 0xc2 ? 2 : 1;
      if (width === 1) {
        text += '\ufffd';
        index += 1;
        continue;
      }
      if (index + width > bytes.length) {
        if (!final) pendingBytes = bytes.slice(index);
        else text += '\ufffd';
        break;
      }

      const continuation = bytes.slice(index + 1, index + width);
      if (continuation.some((byte) => (byte & 0xc0) !== 0x80)) {
        text += '\ufffd';
        index += 1;
        continue;
      }
      let codePoint = first & (width === 2 ? 0x1f : width === 3 ? 0x0f : 0x07);
      continuation.forEach((byte) => {
        codePoint = (codePoint << 6) | (byte & 0x3f);
      });
      const invalid =
        (width === 2 && codePoint < 0x80) ||
        (width === 3 && codePoint < 0x800) ||
        (width === 4 && codePoint < 0x10000) ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
        codePoint > 0x10ffff;
      text += invalid ? '\ufffd' : String.fromCodePoint(codePoint);
      index += width;
    }
    return text;
  };

  const flushLines = (final) => {
    const lines = pendingText.split('\n');
    pendingText = final ? '' : lines.pop();
    lines.forEach((line) => {
      const value = line.replace(/\r$/, '').trim();
      if (value) onEvent(JSON.parse(value));
    });
    if (final) {
      const value = pendingText.trim();
      if (value) onEvent(JSON.parse(value));
      pendingText = '';
    }
  };

  return {
    push(buffer) {
      if (ended) throw new Error('NDJSON stream has ended');
      pendingText += decode(buffer, false);
      flushLines(false);
    },
    end(buffer) {
      if (ended) return;
      ended = true;
      pendingText += decode(buffer, true);
      flushLines(true);
    },
  };
}

// 复用流式解码器解析一次性响应体（如消息接口 409 的 arraybuffer JSON）。
export function parseBufferedJson(buffer) {
  let parsed;
  let seen = false;
  const decoder = createNdjsonStreamDecoder((event) => {
    if (!seen) {
      parsed = event;
      seen = true;
    }
  });
  decoder.push(buffer);
  decoder.end();
  return seen ? parsed : null;
}
