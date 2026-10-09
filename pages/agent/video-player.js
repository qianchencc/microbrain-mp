import globalConfig from '@/config'

// 生产播放页地址未配置时按钮置灰为“播放页接入中”。
export function videoPlayerReady() {
 return Boolean(String(globalConfig.videoPlayerUrl || '').trim())
}

// 点击立即导航；在播放页内按本端来源现取流，加载时仍能返回。
// 会话由既有 webView 契约注入，导航参数不携带凭据或短时效流地址。
export async function openVideoPlayer(device) {
 const base = String(globalConfig.videoPlayerUrl || '').trim()
 if (!base) {
  uni.showToast({ title: '播放页接入中', icon: 'none' })
  return false
 }
 try {
  const params = [
   `assistantVideo=1`,
   `source=${device.source === 'company' ? 'company' : 'office'}`,
   `deviceId=${encodeURIComponent(device.deviceId)}`,
   `name=${encodeURIComponent(device.name || '监控画面')}`,
   `api=${encodeURIComponent(globalConfig.videoPlayerApiUrl || globalConfig.agentUrl)}`,
  ]
  if (device.location) params.push(`loc=${encodeURIComponent(device.location)}`)
  await new Promise((resolve, reject) => uni.navigateTo({ url: `/pages/webView/index?path=${encodeURIComponent(base)}&${params.join('&')}`, success: resolve, fail: reject }))
  return true
 } catch (error) {
  uni.showToast({ title: '未能打开播放页，请重试', icon: 'none' })
  return false
 }
}
