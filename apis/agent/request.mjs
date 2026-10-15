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
     const error = new Error(response.data?.message || '请求处理失败')
     error.status = response.statusCode
     error.data = response.data
     reject(error)
    }
   },
   fail: error => reject(new Error(error.errMsg || '网络连接失败'))
  })
 })
}