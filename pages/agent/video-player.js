import globalConfig from '@/config'
import { getVideoStream } from '@/apis/agent'

// 生产播放页地址未配置时按钮置灰为“播放页接入中”。
export function videoPlayerReady() {
 return Boolean(String(globalConfig.videoPlayerUrl || '').trim())
}

// 「查看画面」统一入口：先向 Runtime 现取短时效流地址，再经既有 webView 页带参打开客户域播放页。
// token/tenantCode 由 webView 页按既有契约自动注入，不落 URL 的是长期凭据（它们已在既有契约里）；
// url 参数把本次取到的 wss 直接交给 H5 开播，deviceId+api 留给 H5 内“重新连接”自取新地址。
export async function openVideoPlayer(device) {
 const base = String(globalConfig.videoPlayerUrl || '').trim()
 if (!base) {
  uni.showToast({ title: '播放页接入中', icon: 'none' })
  return false
 }
 try {
  const stream = await getVideoStream(device.deviceId)
  if (!stream?.url) throw new Error('视频流暂时不可用')
  const params = [
   `deviceId=${encodeURIComponent(device.deviceId)}`,
   `name=${encodeURIComponent(device.name || '监控画面')}`,
   `api=${encodeURIComponent(globalConfig.agentUrl)}`,
   `url=${encodeURIComponent(stream.url)}`,
  ]
  if (device.location) params.push(`loc=${encodeURIComponent(device.location)}`)
  uni.navigateTo({ url: `/pages/webView/index?path=${encodeURIComponent(base)}&${params.join('&')}` })
  return true
 } catch (error) {
  // 取流失败 ≠ 播放失败 ≠ 设备离线：就地诚实报错，不改写设备状态。
  uni.showToast({ title: String(error?.data?.message || error?.message || '视频流暂时不可用').slice(0, 24), icon: 'none' })
  return false
 }
}
