export function httpError(status, data, operation = '业务请求失败') {
 const message = typeof data?.message === 'string' && data.message.trim() ? data.message : `${operation}：HTTP ${status}，服务端未返回具体原因`
 const error = new Error(message)
 error.status = status
 error.data = data
 return error
}

export async function downloadHttpError(response) {
 let body = response.data
 if (response.tempFilePath && typeof uni.getFileSystemManager === 'function') {
  try {
   body = await new Promise(resolve => uni.getFileSystemManager().readFile({
    filePath: response.tempFilePath, encoding: 'utf8',
    success: result => { try { resolve(JSON.parse(result.data)) } catch { resolve(null) } },
    fail: () => resolve(null),
   }))
  } catch { body = null }
 }
 return httpError(response.statusCode, body, '报告下载失败')
}

export function requestJson(url, method, data, header, timeout) {
 // WeChat defaults to application/json, including bodyless POST/DELETE requests.
 const payload = data ?? (['POST', 'DELETE', 'PATCH', 'PUT'].includes(method) ? {} : undefined)
 return new Promise((resolve, reject) => {
  uni.request({
   url, method, data: payload,
   ...(timeout ? { timeout } : {}),
   header: payload === undefined ? header : {...header, 'content-type':'application/json'},
   success: response => {
    if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data)
    else {
     reject(httpError(response.statusCode, response.data))
    }
   },
   fail: error => reject(new Error(error.errMsg || '网络请求失败：未取得服务端响应，网络层未提供具体原因'))
  })
 })
}
