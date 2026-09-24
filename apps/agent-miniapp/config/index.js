// Local development only. Production identity must come from an authenticated session.
// 真实网关联调（手机预览可用；开发者工具模拟器同样可达）：指向本机局域网地址的 3200 实例——
// 唯一 Runtime（IOT_BASE_URL=https://ncim.577119.com，已绑 0.0.0.0）。IP 变了要同步改这里。
export const agentUrl = 'http://10.223.7.61:3200/api'

export function getAgentHeaders() {
  const version = uni.getAccountInfoSync().miniProgram.envVersion
  if (version !== 'develop') throw new Error('独立开发版尚未配置正式登录和服务地址')
  const stored = uni.getStorageSync('agent-auth')
  if (stored) {
    try {
      const auth = JSON.parse(stored)
      if (auth.authorization && auth.tenantcode) return { Authorization: auth.authorization, Tenantcode: auth.tenantcode }
    } catch { /* 存了坏值，走回落 */ }
  }
  // 本机 3200 唯一真实网关实例已配置 AGENT_DEV_IDENTITY：服务端会把 local-development 假身份替换为真实身份，
  // 前端无需任何注入即可用真实物联网。若撤掉服务端替换，缺身份会表现为生产网关 401 的瞬间失败。
  return { Authorization: 'Bearer local-development', Tenantcode: 'LOCAL' }
}
