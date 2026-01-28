import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const app = new Hono();

// --- x402 标准配置 ---
// 你的收款钱包地址 (Base Sepolia 测试网)
const payTo = "0x1ec1053074ba13c21c46c2a7443412cc04140203";

// 创建 facilitator 客户端（测试网）
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator"
});

// 创建资源服务器并注册 EVM 方案
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

// 应用 x402 支付中间件
app.use(
  paymentMiddleware(
    {
      "GET /api/price/[eventId]": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001", // USDC 金额（美元）
            network: "eip155:84532", // Base Sepolia（CAIP-2 格式）
            payTo,
          },
        ],
        description: "获取事件价格数据",
        mimeType: "application/json",
      },
    },
    server,
  ),
);

// 实现受保护的路由
app.get("/api/price/:eventId", (c) => {
  const eventId = c.req.param("eventId");
  return c.json({
    eventId,
    price: "98000.5",
    currency: "USD",
    timestamp: new Date().toISOString(),
  });
});

// 健康检查端点（不需要支付）
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

console.log("x402 Server running on http://localhost:4021");
console.log("Protected endpoint: GET /api/price/:eventId");
console.log("Network: Base Sepolia (eip155:84532)");
console.log("Price: $0.001 USDC per request");

serve({ fetch: app.fetch, port: 4021 });