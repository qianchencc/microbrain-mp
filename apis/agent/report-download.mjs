import { downloadHttpError } from './request.mjs';

// 报告附件下载：PDF/表格共用同一授权加载；身份变化或视图失活的迟到响应不打开文件。

const inactiveError = () => {
  const error = new Error('报告预览已关闭，请重新打开');
  error.data = { code: 'REPORT_VIEW_INACTIVE' };
  return error;
};

export function downloadReportFile(
  { reportId, source = 'company', format = 'pdf' } = {},
  { baseUrl, getHeaders, getScope, downloadFile, openDocument, isActive = () => true } = {}
) {
  if (typeof reportId !== 'string' || !reportId)
    return Promise.reject(new Error('缺少报告标识'));
  if (format !== 'pdf' && format !== 'xlsx')
    return Promise.reject(new Error('格式不支持'));
  if (typeof downloadFile !== 'function' || typeof openDocument !== 'function')
    return Promise.reject(new Error('仅支持小程序内查看'));
  let scope = '';
  try {
    scope = getScope();
  } catch (error) {
    return Promise.reject(error);
  }
  if (!isActive()) return Promise.reject(inactiveError());
  return new Promise((resolve, reject) => {
    const query = format === 'pdf' ? '' : `&format=${format}`;
    downloadFile({
      url:
        baseUrl +
        `/agent/reports/${encodeURIComponent(reportId)}/download?source=${encodeURIComponent(source)}${query}`,
      header: getHeaders(),
      success: async (response) => {
        try {
          const status = response.statusCode;
          if (status !== 200 || !response.tempFilePath) {
            const error =
              status === 200 ? new Error('文件无效') : await downloadHttpError(response);
            reject(error);
            return;
          }
          const currentScope = getScope();
          if (currentScope !== scope) {
            const error = new Error('登录身份已变化，请重新打开报告');
            error.data = { code: 'SCOPE_CHANGED' };
            reject(error);
            return;
          }
          if (!isActive()) {
            reject(inactiveError());
            return;
          }
          openDocument({
            filePath: response.tempFilePath,
            fileType: format,
            showMenu: true,
            success: () => resolve(response.tempFilePath),
            fail: (cause) => reject(new Error(cause?.errMsg || '打开失败，请重试')),
          });
        } catch (cause) {
          reject(cause);
        }
      },
      fail: (cause) => reject(new Error(cause?.errMsg || '下载失败，请重试')),
    });
  });
}
