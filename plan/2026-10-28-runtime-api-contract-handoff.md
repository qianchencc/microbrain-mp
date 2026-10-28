# Runtime API 契约文档交接

日期：2026-10-28

## 结论

已在同级仓库 `../iot-agent-runtime` 完成 Runtime 对外接口文档，不修改本小程序仓库的业务源码，也不把客户 Office、Energy、Perception 上游 Swagger 合并为我方 API。

Runtime 提交：`cbc5cca docs(api): publish runtime contract and drift gate`

## 交付内容

- `docs/api/openapi.json`：机器可读的 OpenAPI 3.1 契约。
- `docs/api/openapi.yaml`：同一契约的审阅版本。
- `docs/api/ndjson-events.schema.yaml`：Agent 流式响应的单行事件 schema。
- `docs/api/ndjson-events.md`：事件顺序、终态、断线恢复和取消语义。
- `tools/generate-api-contract.mjs`：从当前 Runtime 契约定义生成 JSON/YAML。
- `tools/check-api-contract.mjs`：路由、认证、JSON/YAML、关键 schema 和 NDJSON 契约门禁。
- `README.md`：补充文档入口和验证命令。

当前契约覆盖 66 个路径、69 个 operation，包括 Agent、Admin 和 `/healthz`。

## 使用与维护

从 `iot-agent-runtime` 仓库根目录运行：

```bash
npm run api:contract
```

Runtime 路由、请求参数或认证边界变更后，必须重新运行该命令并提交生成的 `docs/api/openapi.json` 与 `openapi.yaml`。Node.js 仍按 Runtime 约定使用 22.x。

## 验证

- `npm run api:contract`：通过，69 operations / 66 paths。
- `npm test`：通过，452 tests / 0 failures。
- `npm run build`：通过。
- `npm run typecheck`：未通过，当前仓库仍有 4 个诊断：`apps/runtime/test/company-dashboard.test.ts` 的 3 个 `Promise.withResolvers` 类型错误，以及 `apps/runtime/test/regions.test.ts` 的 1 个隐式 `any`。

## 边界与限制

- 小程序仓库只作为 Runtime API 的消费者，不纳入本次 OpenAPI 交付。
- 客户网关上游接口不是 Runtime 对外契约；需要时另行维护依赖目录和真实核验状态。
- 复杂业务响应中仍有部分宽泛 JSON schema，当前交付重点是路径、请求、认证、错误、流式协议和漂移门禁，不宣称所有响应字段都已逐字段冻结。
- 当前没有部署 Swagger UI/Redoc；JSON/YAML 和 NDJSON schema 是权威交付物。
