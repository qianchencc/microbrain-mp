# Standalone IoT Agent Regression Shell

This directory is a self-contained Vue 3 uni-app project for Agent UI regression, interaction verification, demonstrations, and fault reproduction. It is not the production client. New business capabilities belong in the customer mini-program at the repository root.

The shell has a test AppID, no customer login lifecycle, and no production session ownership. Its fixed development identity is permitted only in `develop`; `trial` and `release` must fail closed. The current production decision and acceptance status live in [`docs/README.md`](../../docs/README.md).

## Local verification

```sh
npm test
npm run test:weixin
```

Import `unpackage/dist/build/mp-weixin` into WeChat DevTools for native visual and interaction checks. The build script uses HBuilderX's bundled compiler; set `UNI_COMPILER_DIR` or `UNI_NODE_BIN` only when that installation is non-standard.

## Runtime routing

Read `config/index.js` for the active development address instead of copying an IP from documentation. There is a single local Runtime instance: `3200` connected to the real customer gateway (Iotfake and `3201` were retired on 2026-09-23). The shell points at that same `3200` real-gateway Runtime via the Mac's LAN IP; its automated tests never depend on real devices.

A phone cannot reach the Mac through `127.0.0.1`; phone preview requires a reachable LAN address and a Runtime listening on `0.0.0.0`. The local port is not an experience/release deployment address.

## Voice input

WechatSI is optional in this shell. Recognition requires the AppID owner to authorize the plugin and register it under `mp-weixin.plugins`; otherwise text input remains the supported path. The customer project owns production plugin registration and acceptance.

## Maintenance boundary

- Keep tests and reproduction facilities needed to diagnose native-only problems.
- Do not develop new customer business features here.
- Do not copy this shell's fixed identity, AppID, manifest, or environment configuration into the customer mini-program.
- Backport a customer fix only when the shell is needed to reproduce or guard that behavior.
