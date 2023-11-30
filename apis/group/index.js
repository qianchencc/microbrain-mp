import request from '../request'

// 加入社团
export const joinGroup = number => request.globalRequest(`/futurecommunity/mini/association/joinApply?number=${number}`, 'POST')
