# x402 支付协议测试报告

**测试日期**: 2026-01-26
**测试网络**: Base Sepolia (eip155:84532)
**x402 SDK 版本**: 2.2.0

---

## 1. 测试概述

本次测试验证了 x402 支付协议的完整流程，包括：
- 服务端支付中间件配置
- 客户端自动支付处理
- 链上交易结算

## 2. 测试环境

| 组件 | 配置 |
|------|------|
| 服务端框架 | Hono |
| 运行端口 | 4021 |
| 支付网络 | Base Sepolia |
| 支付代币 | USDC |
| 单次请求价格 | $0.001 |
| Facilitator | https://x402.org/facilitator |

## 3. 测试账户

| 角色 | 地址 |
|------|------|
| 付款方 (Payer) | `0x9b72b76F0805E785703Aa7Cfe49B9A21582E464d` |
| 收款方 (PayTo) | `0x1ec1053074ba13c21c46c2a7443412cc04140203` |

## 4. x402 支付流程详解

### 4.1 流程图

```
┌─────────┐     1. GET /api/price/xxx      ┌─────────┐
│         │ ─────────────────────────────► │         │
│         │                                │         │
│         │     2. 402 Payment Required    │         │
│ Client  │ ◄───────────────────────────── │ Server  │
│         │    (返回支付要求信息)            │         │
│         │                                │         │
│         │     3. 签名支付 + 重新请求       │         │
│         │ ─────────────────────────────► │         │
│         │    (携带 PAYMENT-SIGNATURE)    │         │
│         │                                │         │
│         │     4. 200 OK + 支付收据        │         │
│         │ ◄───────────────────────────── │         │
└─────────┘                                └─────────┘
```

### 4.2 详细步骤说明

#### 步骤 1: 客户端发起请求

客户端向受保护的 API 端点发送普通 HTTP 请求：

```typescript
const response = await fetchWithPayment(url, { method: "GET" });
```

#### 步骤 2: 服务端返回 402 Payment Required

服务端检测到该端点需要支付，返回 HTTP 402 状态码，并在响应头中包含支付要求：

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: {
  "accepts": [{
    "scheme": "exact",
    "price": "$0.001",
    "network": "eip155:84532",
    "payTo": "0x1ec1053074ba13c21c46c2a7443412cc04140203"
  }],
  "description": "获取事件价格数据",
  "mimeType": "application/json"
}
```

#### 步骤 3: 客户端签名并重新请求

x402 客户端自动：
1. 解析 `PAYMENT-REQUIRED` 头
2. 使用私钥签署支付载荷
3. 将签名放入 `PAYMENT-SIGNATURE` 头
4. 重新发送请求

#### 步骤 4: 服务端验证并返回数据

服务端通过 Facilitator 验证支付签名，确认后：
1. 执行链上转账
2. 返回请求的数据
3. 在响应头中附带支付收据

## 5. 测试结果

### 5.1 请求成功

```
状态: 成功 ✓
```

### 5.2 响应数据

```json
{
  "eventId": "match_final_001",
  "price": "98000.5",
  "currency": "USD",
  "timestamp": "2026-01-26T08:24:36.161Z"
}
```

### 5.3 支付收据

```json
{
  "success": true,
  "transaction": "0xcbdf9c3a2f1060e773c624fea4bb4c0cf21f62a506cbe87ec0bb522154e2d3fe",
  "network": "eip155:84532",
  "payer": "0x9b72b76F0805E785703Aa7Cfe49B9A21582E464d"
}
```

### 5.4 链上交易验证

交易可在 Base Sepolia 区块浏览器查看：

https://sepolia.basescan.org/tx/0xcbdf9c3a2f1060e773c624fea4bb4c0cf21f62a506cbe87ec0bb522154e2d3fe

## 6. 核心代码解析

### 6.1 服务端配置 (server.ts)

```typescript
// 1. 创建 Facilitator 客户端（负责验证支付和结算）
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator"
});

// 2. 创建资源服务器并注册 EVM 支付方案
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

// 3. 配置支付中间件，定义哪些路由需要支付
app.use(
  paymentMiddleware(
    {
      "GET /api/price/[eventId]": {
        accepts: [{
          scheme: "exact",           // 精确支付方案
          price: "$0.001",           // 价格
          network: "eip155:84532",   // Base Sepolia 网络
          payTo,                     // 收款地址
        }],
        description: "获取事件价格数据",
        mimeType: "application/json",
      },
    },
    server,
  ),
);
```

### 6.2 客户端配置 (client.ts)

```typescript
// 1. 创建签名器（使用私钥）
const signer = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

// 2. 创建 x402 客户端并注册 EVM 方案
const client = new x402Client();
registerExactEvmScheme(client, { signer });

// 3. 包装 fetch，自动处理 402 支付流程
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// 4. 使用包装后的 fetch 发起请求（支付自动处理）
const response = await fetchWithPayment(url, { method: "GET" });
```

## 7. 关键概念

### 7.1 Facilitator（协调者）

Facilitator 是 x402 协议中的核心组件，负责：
- 验证客户端的支付签名
- 执行链上转账
- 返回交易收据

本次测试使用官方测试网 Facilitator: `https://x402.org/facilitator`

### 7.2 CAIP-2 网络标识

x402 使用 CAIP-2 标准标识区块链网络：
- `eip155:84532` = Base Sepolia 测试网
- `eip155:8453` = Base 主网
- `eip155:1` = Ethereum 主网

### 7.3 支付方案 (Scheme)

`exact` 方案表示精确支付，即每次请求支付固定金额。x402 还支持其他方案如订阅等。

## 8. 测试结论

| 测试项 | 结果 |
|--------|------|
| 服务端启动 | ✓ 通过 |
| 客户端连接 | ✓ 通过 |
| 402 响应处理 | ✓ 通过 |
| 支付签名 | ✓ 通过 |
| 链上结算 | ✓ 通过 |
| 数据返回 | ✓ 通过 |

**总结**: x402 支付协议在 Base Sepolia 测试网上运行正常，完整支付流程验证通过。

---

## 附录: 运行测试

```bash
# 安装依赖
npm install

# 启动服务端（终端 1）
npm run server

# 运行客户端测试（终端 2）
npm run client
```