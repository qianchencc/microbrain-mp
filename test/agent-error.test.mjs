import test from 'node:test';
import assert from 'node:assert/strict';
import { agentErrorText } from '../utils/agent-error.mjs';

test('上游超时按用户要求收敛为短文案', () => {
	const cause = new Error('ENERGY_HISTORY：客户观察上游请求超时：只读观察上游当前不可用，请稍后重试');
	cause.data = { code: 'OBSERVATION_UPSTREAM_UNAVAILABLE' };
	assert.equal(agentErrorText(cause), '上游暂不可用，稍后重试');
});

test('超时文案按场景可区分', () => {
	assert.equal(agentErrorText(new Error('等待回答超时'), { timeout: '回答超时，请重试' }), '回答超时，请重试');
	assert.equal(agentErrorText(new Error('request:fail timeout'), { fallback: '读取失败，请重试' }), '请求超时，稍后重试');
});

test('传输层失败归为网络异常', () => {
	const cause = new Error('net::ERR_CONNECTION_REFUSED');
	cause.transport = true;
	assert.equal(agentErrorText(cause), '网络异常，稍后重试');
	assert.equal(agentErrorText('request:fail'), '网络异常，稍后重试');
});

test('后端错误码优先于原文', () => {
	assert.equal(
		agentErrorText({ code: 'SAFETY_DEVICE_OUTSIDE_SCOPE', message: '设备不在当前告警类型的授权范围内' }),
		'暂无权限'
	);
	assert.equal(agentErrorText({ code: 'ACCOUNT_IDENTITY_PREPARING' }), '数据准备中，请稍后重试');
	assert.equal(agentErrorText({ code: 'CANDIDATE_SET_STALE' }), '数据已变化，请刷新后重试');
});

test('HTTP 状态兜底', () => {
	assert.equal(agentErrorText({ status: 401, message: 'x' }), '暂无权限');
	assert.equal(agentErrorText({ status: 404, message: 'x' }), '记录不存在或已删除');
	assert.equal(agentErrorText({ status: 409, message: 'x' }), '数据已变化，请刷新后重试');
	assert.equal(agentErrorText({ status: 503, message: 'ENERGY_HISTORY：上游超时' }), '上游暂不可用，稍后重试');
	assert.equal(agentErrorText({ status: 500, message: 'timeout waiting reply' }), '后端超时，稍后重试');
	assert.equal(agentErrorText({ status: 502, message: 'bad gateway' }), '后端异常，稍后重试');
});

test('非错误信息与未知错误走兜底，不误伤非错误文案', () => {
	assert.equal(agentErrorText(null), '操作失败，请重试');
	assert.equal(agentErrorText(new Error('model returned empty'), { fallback: '回答未完成，请重试' }), '回答未完成，请重试');
	// 「当前版本暂不支持语音输入」不含错误模式，走 fallback，不会被误判成数据已变化
	assert.equal(agentErrorText(new Error('当前版本暂不支持语音输入'), { fallback: '操作失败，请重试' }), '操作失败，请重试');
});
