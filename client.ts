import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// --- 配置 ---
// 注意：生产环境应使用环境变量 process.env.EVM_PRIVATE_KEY
// 这里为了演示使用硬编码的测试私钥
const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || "0x5eeaacb083992d79504ceefead421a3fe8f42c835d0895e2b6404dd212a0f96a";

// 创建签名器（符合 x402 标准文档）
const signer = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

// 创建 x402 客户端并注册 EVM 方案（使用标准参数格式）
const client = new x402Client();
registerExactEvmScheme(client, { signer });

// 创建 HTTP 客户端用于获取支付收据
const httpClient = new x402HTTPClient(client);

// 用支付处理包装 fetch（使用标准 API）
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

async function getPrice(eventId: string) {
  const url = `http://localhost:4021/api/price/${eventId}`;

  console.log("=".repeat(50));
  console.log("x402 客户端 - 符合标准的支付流程");
  console.log("=".repeat(50));
  console.log(`\n钱包地址: ${signer.address}`);
  console.log(`目标 URL: ${url}`);
  console.log(`网络: Base Sepolia (eip155:84532)`);

  try {
    console.log("\n1. 发送请求...");
    console.log("   (如果需要支付，x402 客户端会自动处理)");

    // fetchWithPayment 会自动：
    // 1. 发送初始请求
    // 2. 如果收到 402，解析 PAYMENT-REQUIRED 头
    // 3. 签署支付载荷
    // 4. 在 PAYMENT-SIGNATURE 头中附带签名重新请求
    const response = await fetchWithPayment(url, {
      method: "GET",
    });

    if (response.ok) {
      const data = await response.json();
      console.log("\n2. 请求成功！");
      console.log("   响应数据:", JSON.stringify(data, null, 2));

      // 从响应头获取支付收据（符合 x402 标准）
      try {
        const paymentResponse = httpClient.getPaymentSettleResponse(
          (name) => response.headers.get(name)
        );
        if (paymentResponse) {
          console.log("\n3. 支付已结算:");
          console.log("   收据:", JSON.stringify(paymentResponse, null, 2));
        }
      } catch {
        // 如果没有支付头，说明可能是免费请求或支付已在之前完成
        console.log("\n   (无支付收据 - 可能是免费请求或测试模式)");
      }
    } else {
      console.error("\n请求失败:", response.status, response.statusText);
      const errorText = await response.text();
      console.error("错误详情:", errorText);
    }
  } catch (error: any) {
    console.error("\n发生错误:", error.message);

    // 标准错误处理（符合 x402 文档）
    if (error.message.includes("No scheme registered")) {
      console.error("网络不支持 - 请注册相应的方案");
    } else if (error.message.includes("Payment already attempted")) {
      console.error("重试时支付失败");
    } else if (error.message.includes("insufficient")) {
      console.log("\n提示: 请确保钱包中有足够的:");
      console.log("  - Base Sepolia ETH (用于 Gas)");
      console.log("  - Base Sepolia USDC (用于支付)");
      console.log("\n获取测试代币:");
      console.log("  - ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
      console.log("  - USDC: 可以在 Base Sepolia 上的 DEX 获取测试 USDC");
    } else {
      console.error("请求失败:", error);
    }
  }
}

// 运行示例
getPrice("match_final_001");
