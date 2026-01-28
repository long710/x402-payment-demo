# x402 测试项目 Runbook

本文档提供 x402 支付协议测试项目的操作指南。

---

## 1. 环境准备

### 1.1 系统要求

- Node.js >= 18.x
- npm >= 9.x

### 1.2 安装依赖

```bash
cd /path/to/Proto402-Usage-Test
npm install
```

### 1.3 环境变量（可选）

如需使用自己的钱包，设置环境变量：

```bash
export EVM_PRIVATE_KEY="0x你的私钥"
```

> 注意：项目已内置测试私钥，可直接运行测试。

---

## 2. 运行测试

### 2.1 启动服务端

**终端 1：**

```bash
npm run server
```

**预期输出：**

```
x402 Server running on http://localhost:4021
Protected endpoint: GET /api/price/:eventId
Network: Base Sepolia (eip155:84532)
Price: $0.001 USDC per request
```

### 2.2 运行客户端

**终端 2：**

```bash
npm run client
```

**预期输出：**

```
==================================================
x402 客户端 - 符合标准的支付流程
==================================================

钱包地址: 0x9b72b76F0805E785703Aa7Cfe49B9A21582E464d
目标 URL: http://localhost:4021/api/price/match_final_001
网络: Base Sepolia (eip155:84532)

1. 发送请求...
   (如果需要支付，x402 客户端会自动处理)

2. 请求成功！
   响应数据: {
  "eventId": "match_final_001",
  "price": "98000.5",
  "currency": "USD",
  "timestamp": "2026-01-26T08:24:36.161Z"
}

3. 支付已结算:
   收据: {
  "success": true,
  "transaction": "0x...",
  "network": "eip155:84532",
  "payer": "0x9b72b76F0805E785703Aa7Cfe49B9A21582E464d"
}
```

---

## 3. 手动测试 API

### 3.1 测试健康检查（无需支付）

```bash
curl http://localhost:4021/health
```

**预期响应：**

```json
{"status":"ok"}
```

### 3.2 测试受保护端点（触发 402）

```bash
curl -i http://localhost:4021/api/price/test123
```

**预期响应：**

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: {"accepts":[{"scheme":"exact","price":"$0.001",...}],...}
```

---

## 4. 验证链上交易

### 4.1 获取交易哈希

从客户端输出的支付收据中获取 `transaction` 字段。

### 4.2 在区块浏览器查看

访问 Base Sepolia 区块浏览器：

```
https://sepolia.basescan.org/tx/<交易哈希>
```

---

## 5. 故障排查

### 5.1 服务端启动失败

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `EADDRINUSE` | 端口 4021 被占用 | 关闭占用进程或修改端口 |
| `MODULE_NOT_FOUND` | 依赖未安装 | 运行 `npm install` |

**查找占用端口的进程：**

```bash
lsof -i :4021
```

**终止进程：**

```bash
kill -9 <PID>
```

### 5.2 客户端支付失败

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `No scheme registered` | 未注册支付方案 | 检查客户端代码中的 `registerExactEvmScheme` |
| `insufficient funds` | 钱包余额不足 | 获取测试代币（见 5.3） |
| `ECONNREFUSED` | 服务端未启动 | 先启动服务端 |

### 5.3 获取测试代币

**Base Sepolia ETH（Gas 费）：**

- https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

**Base Sepolia USDC（支付）：**

- 在 Base Sepolia DEX 获取测试 USDC
- 或使用已有测试代币的钱包

---

## 6. 配置参考

### 6.1 服务端配置

| 参数 | 当前值 | 说明 |
|------|--------|------|
| 端口 | 4021 | 服务监听端口 |
| 收款地址 | `0x1ec1053074ba13c21c46c2a7443412cc04140203` | 接收支付的钱包 |
| 网络 | `eip155:84532` | Base Sepolia |
| 价格 | `$0.001` | 每次请求的 USDC 费用 |
| Facilitator | `https://x402.org/facilitator` | 测试网协调器 |

### 6.2 客户端配置

| 参数 | 当前值 | 说明 |
|------|--------|------|
| 私钥 | 内置测试私钥 | 可通过环境变量覆盖 |
| 钱包地址 | `0x9b72b76F0805E785703Aa7Cfe49B9A21582E464d` | 付款方地址 |

---

## 7. 常用命令速查

```bash
# 安装依赖
npm install

# 启动服务端
npm run server

# 运行客户端
npm run client

# 查看端口占用
lsof -i :4021

# 终止后台进程
pkill -f "ts-node.*server.ts"

# 查看 TypeScript 编译错误
npx tsc --noEmit
```

---

## 8. 相关文档

- [README.md](./README.md) - 项目说明
- [x402-test-report.md](./x402-test-report.md) - 测试报告
- [quick-startfor-buyers.md](./quick-startfor-buyers.md) - 买方指南
- [quick-startfor-sellers.md](./quick-startfor-sellers.md) - 卖方指南
