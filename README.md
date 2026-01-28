# x402 支付协议测试项目

本项目用于测试和演示 x402 支付协议的完整流程。

## 项目结构

```
├── server.ts                  # x402 服务端示例
├── client.ts                  # x402 客户端示例
├── quick-startfor-buyers.md   # 买方快速入门指南
├── quick-startfor-sellers.md  # 卖方快速入门指南
├── x402-test-report.md        # 测试报告
└── package.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务端

```bash
npm run server
```

服务端将在 `http://localhost:4021` 启动，提供受保护的 API 端点。

### 运行客户端测试

```bash
npm run client
```

客户端会自动处理 402 支付流程并获取数据。

## 配置说明

| 配置项 | 值 |
|--------|-----|
| 网络 | Base Sepolia (eip155:84532) |
| 支付代币 | USDC |
| 单次请求价格 | $0.001 |
| Facilitator | https://x402.org/facilitator |

## 文档

- [买方快速入门](./quick-startfor-buyers.md) - 如何作为买方使用 x402 支付访问 API
- [卖方快速入门](./quick-startfor-sellers.md) - 如何为你的 API 集成 x402 支付
- [测试报告](./x402-test-report.md) - 本项目的测试记录和流程详解

## 依赖

- `@x402/hono` - Hono 框架的 x402 中间件
- `@x402/fetch` - 支持 x402 支付的 fetch 包装器
- `@x402/core` - x402 核心库
- `@x402/evm` - EVM 链支付方案
- `hono` - Web 框架
- `viem` - 以太坊交互库

## 参考链接

- [x402 官方文档](https://x402.gitbook.io/x402)
- [x402 GitHub](https://github.com/coinbase/x402)
- [x402 Bazaar](https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer)
