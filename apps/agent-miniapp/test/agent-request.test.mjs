import test from 'node:test'
import assert from 'node:assert/strict'
import {requestJson} from '../apis/agent/request.mjs'

test('无参数清空和新建会话发送合法 JSON，保留有参数请求与错误响应', async t => {
 const previous = globalThis.uni
 t.after(() => { if(previous === undefined) delete globalThis.uni; else globalThis.uni = previous })
 const sent=[]
 globalThis.uni={request(options) {
  sent.push(options)
  const body=options.data === undefined ? '' : JSON.stringify(options.data)
  if(options.method !== 'GET' && !body) {
   options.success({statusCode:400,data:{message:"Body cannot be empty when content-type is set to 'application/json'"}})
  } else options.success({statusCode:200,data:{ok:true}})
 }}
 for(const method of ['DELETE','POST']) assert.deepEqual(await requestJson('/conversation',method,undefined,{}),{ok:true})
 assert.deepEqual(await requestJson('/selection','PATCH',{revision:2},{}),{ok:true})
 assert.deepEqual(sent[2].data,{revision:2})
 await requestJson('/conversation','GET',undefined,{})
 assert.equal(sent[3].data,undefined)
 globalThis.uni.request=options=>options.success({statusCode:409,data:{message:'请等待当前请求结束后清除',code:'BUSY'}})
 await assert.rejects(requestJson('/conversation','DELETE',undefined,{}),error=>error.message==='请等待当前请求结束后清除' && error.data.code==='BUSY')
})