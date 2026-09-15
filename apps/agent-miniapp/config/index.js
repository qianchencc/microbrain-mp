// Local simulator only. Production identity must come from an authenticated session.
export const agentUrl = 'http://127.0.0.1:3200/api'

export function getAgentHeaders() {
  const version = uni.getAccountInfoSync().miniProgram.envVersion
  if (version !== 'develop') throw new Error('独立开发版尚未配置正式登录和服务地址')
  return { Authorization: 'Bearer local-development', Tenantcode: 'LOCAL' }
}