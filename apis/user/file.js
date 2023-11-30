import request from '../request'

// 上传文件
export const uploadFile = (data) => request.globalRequest('/setting/file/upload', 'POST', data)

// 上传并返回文件路径和文件名
export const uploadFileWithInfo = (data) => request.globalRequest('/setting/file/upload/info', 'POST', data)

// 下载文件
export const downloadFile = (params) => request.globalRequest('/setting/file/download', 'GET', params)
