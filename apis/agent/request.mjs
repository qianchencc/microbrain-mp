export function httpError(status, data, operation = '业务请求失败') {
  const message =
    typeof data?.message === 'string' && data.message.trim()
      ? data.message
      : `${operation}：HTTP ${status}，服务端未返回具体原因`;
  const error = new Error(message);
  error.status = status;
  error.data = data;
  return error;
}

export async function downloadHttpError(response) {
  let body = response.data;
  if (response.tempFilePath && typeof uni.getFileSystemManager === 'function') {
    try {
      body = await new Promise((resolve) =>
        uni.getFileSystemManager().readFile({
          filePath: response.tempFilePath,
          encoding: 'utf8',
          success: (result) => {
            try {
              resolve(JSON.parse(result.data));
            } catch {
              resolve(null);
            }
          },
          fail: () => resolve(null),
        })
      );
    } catch {
      body = null;
    }
  }
  return httpError(response.statusCode, body, '报告下载失败');
}

export function requestJson(url, method, data, header, timeout) {
  // WeChat defaults to application/json, including bodyless POST/DELETE requests.
  const payload = data ?? (['POST', 'DELETE', 'PATCH', 'PUT'].includes(method) ? {} : undefined);
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method,
      data: payload,
      ...(timeout ? { timeout } : {}),
      header: payload === undefined ? header : { ...header, 'content-type': 'application/json' },
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
        else {
          reject(httpError(response.statusCode, response.data));
        }
      },
      fail: (error) => {
        const failure = new Error(
          error.errMsg || '网络请求失败：未取得服务端响应，网络层未提供具体原因'
        );
        failure.transport = true;
        reject(failure);
      },
    });
  });
}

// 先核实原对象。仅确定仍未执行、版本未变时重试；未知下发绝不重放。
export async function recoverDraftRequest(url, method, data, header, timeout, isActive) {
  if (!isActive()) throw new Error('会话身份已变化');
  const match = url.match(
    /^(.*\/action-drafts\/[^/?]+)\/(confirm|selection|parameters|restore|revalidate|cancel)(\?.*)?$/
  );
  const snapshot = await requestJson(
    match[1] + (match[3] || ''),
    'GET',
    undefined,
    header,
    timeout
  );
  if (!isActive()) throw new Error('会话身份已变化');
  const operation = match[2];
  if (operation === 'revalidate' && snapshot.revalidatedInto) {
    const collection = match[1].slice(0, match[1].lastIndexOf('/'));
    const replacement = await requestJson(
      `${collection}/${encodeURIComponent(snapshot.revalidatedInto)}${match[3] || ''}`,
      'GET',
      undefined,
      header,
      timeout
    );
    if (!isActive()) throw new Error('会话身份已变化');
    return replacement;
  }
  if (operation === 'confirm') {
    if (snapshot.result) return snapshot.result;
    if (snapshot.status === 'EXECUTING') return { draftId: snapshot.draftId, status: 'EXECUTING' };
  }
  if (operation === 'cancel' && snapshot.status === 'CANCELLED') return snapshot;
  if (snapshot.revision === data?.revision + 1) {
    const expected = {
      selection: 'ACTION_DRAFT_SELECTION_CHANGED',
      parameters: 'ACTION_DRAFT_PARAMETERS_CHANGED',
      restore: 'ACTION_DRAFT_RESTORED',
      revalidate: 'ACTION_DRAFT_REVALIDATED',
    }[operation];
    let matches = snapshot.revisionOperation === expected && Boolean(expected);
    if (operation === 'selection')
      matches &&=
        snapshot.selectedActionIds.length === data.selectedActionIds.length &&
        data.selectedActionIds.every((id) => snapshot.selectedActionIds.includes(id));
    if (operation === 'parameters')
      matches &&= data.changes.every((change) =>
        Object.entries(change.patch).every(
          ([key, value]) =>
            snapshot.actions.find((action) => action.id === change.actionId)?.command[key] === value
        )
      );
    if (matches) return snapshot;
  }
  const unchanged = snapshot.revision === data?.revision;
  if (
    (snapshot.status === 'PENDING_CONFIRMATION' && (unchanged || operation === 'cancel')) ||
    (operation === 'revalidate' && unchanged && snapshot.status === 'EXPIRED')
  ) {
    return requestJson(url, method, data, header, timeout);
  }
  throw httpError(409, {
    message: '草案已变化，已保留当前状态；请核对后重新确认',
    recovery: { draft: snapshot },
  });
}
