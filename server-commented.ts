// ============================================================================
// server.ts - x402 服务端（Oracle 预言机）
// 功能：提供付费 API，签发 nonce，验证链上支付，签发 JWT 收据
// ============================================================================

// 引入 Hono 的 Node.js 服务器适配器
import { serve } from '@hono/node-server';
// 引入 Hono 框架（轻量级 Web 框架，类似 Express）
import { Hono } from 'hono';
// 引入 JWT 签名和验证函数
import { sign, verify } from 'hono/jwt';
// 引入 ethers.js 用于与区块链交互
import { ethers } from 'ethers';

// 创建 Hono 应用实例
const app = new Hono();

// --- 核心配置 ---
// BSC 主网的 RPC 节点地址
const BSC_RPC = "https://bsc-dataseed.binance.org/";
// 创建 Provider 用于查询链上数据（只读，不需要私钥）
const provider = new ethers.JsonRpcProvider(BSC_RPC);
// JWT 签名密钥（用于签发和验证收据）
// 注意：生产环境应使用环境变量存储
const SECRET_KEY = "your_internal_secret_key";
// Oracle 的收款钱包地址
const ORACLE_WALLET = "0x1ec1053074ba13c21c46c2a7443412cc04140203";
// 接受支付的 ERC-20 代币合约地址
const TOKEN_ADDRESS = "0xe4a47ca9be22b07ea37dbe6cb7479d7ef2f18548";

// 存储已签发的 Nonce 与 EventId 的对应关系
// 用于验证支付时确认 nonce 的有效性
const pendingNonces = new Map<string, string>();

/**
 * 验证 BSC 链上的代币转账
 * 这是 x402 协议的核心验证逻辑
 *
 * @param txHash - 客户端提交的交易哈希
 * @param expectedNonce - 期望在交易中找到的 nonce
 * @returns 验证是否通过
 */
async function verifyTokenPayment(txHash: string, expectedNonce: string) {
    try {
        // 从链上获取交易详情（包含 input data）
        const tx = await provider.getTransaction(txHash);
        // 从链上获取交易收据（包含执行结果和事件日志）
        const receipt = await provider.getTransactionReceipt(txHash);

        // 基础验证：交易必须存在且执行成功
        // receipt.status === 1 表示交易成功，0 表示失败
        if (!tx || !receipt || receipt.status !== 1) return false;

        // ========== 验证 1：检查目标合约地址 ==========
        // 确保交易是发送到我们指定的代币合约
        if (tx.to?.toLowerCase() !== TOKEN_ADDRESS.toLowerCase()) return false;

        // ========== 验证 2：检查 Nonce 是否在交易数据中 ==========
        // 将期望的 nonce 转换为十六进制格式
        // slice(2) 去掉 "0x" 前缀，因为 tx.data 中不包含这个前缀
        const nonceHex = ethers.hexlify(ethers.toUtf8Bytes(expectedNonce)).slice(2);
        // 检查交易的 input data 中是否包含这个 nonce
        // 这是防重放攻击的关键：每个 nonce 只能用一次
        if (!tx.data.includes(nonceHex)) return false;

        // ========== 验证 3：检查 ERC-20 Transfer 事件 ==========
        // 计算 Transfer 事件的签名哈希
        // Transfer(address,address,uint256) 的 keccak256 哈希
        const transferTopic = ethers.id("Transfer(address,address,uint256)");
        // 在交易日志中查找 Transfer 事件
        // topics[0] 是事件签名，topics[1] 是 from，topics[2] 是 to
        const log = receipt.logs.find(l => l.topics[0] === transferTopic);
        // 如果没有找到 Transfer 事件，说明转账没有发生
        if (!log) return false;

        // ========== 验证 4：检查收款地址 ==========
        // 从事件日志中解析收款人地址
        // topics[2] 是 to 地址，但被填充到 32 字节，需要取后 20 字节
        // dataSlice(log.topics[2], 12) 跳过前 12 字节的零填充
        const recipient = ethers.getAddress(ethers.dataSlice(log.topics[2], 12));
        // 验证收款地址是否是我们的 Oracle 钱包
        return recipient.toLowerCase() === ORACLE_WALLET.toLowerCase();

    } catch (e) {
        // 查询链上数据失败（网络问题、无效哈希等）
        console.error("查账失败:", e);
        return false;
    }
}

// ============================================================================
// API 路由：GET /api/price/:eventId
// 这是付费 API 的核心端点，实现了 x402 协议的三层验证逻辑
// ============================================================================
app.get('/api/price/:eventId', async (c) => {
    // 从 URL 路径中获取 eventId 参数
    const eventId = c.req.param('eventId');

    // ========== 第一层：检查 JWT 收据（快速通道）==========
    // 如果客户端已经有有效的收据，直接返回数据，无需再次验证
    const oldReceipt = c.req.header('x-402-receipt');
    if (oldReceipt) {
        try {
            // 验证 JWT 签名和有效期
            const payload = await verify(oldReceipt, SECRET_KEY);
            // 确认收据对应的 eventId 与请求的一致
            if (payload.eventId === eventId) {
                // 收据有效，直接返回数据
                return c.json({ price: "98000.5", status: "Access via Receipt" });
            }
        } catch (e) {
            // JWT 验证失败（过期、签名无效等），继续后续验证流程
        }
    }

    // ========== 第二层：检查支付证明 ==========
    // 客户端提交了交易哈希和 nonce，需要验证链上支付
    const txHash = c.req.header('x-402-payment-proof');
    const nonce = c.req.header('x-402-nonce');

    if (txHash && nonce) {
        // 调用链上验证函数
        if (await verifyTokenPayment(txHash, nonce)) {
            // 验证通过！签发新的 JWT 收据
            const receipt = await sign({
                eventId,  // 收据绑定到特定的 eventId
                // 设置过期时间：当前时间 + 3600 秒（1 小时）
                exp: Math.floor(Date.now() / 1000) + 3600
            }, SECRET_KEY);

            // 返回数据和收据
            // 客户端可以保存收据，在有效期内重复使用
            return c.json({ price: "98000.5", receipt });
        }
        // 验证失败，返回 403 Forbidden
        return c.json({ error: "Payment verification failed" }, 403);
    }

    // ========== 第三层：无认证信息，返回 402 ==========
    // 客户端没有提供收据或支付证明，需要付款

    // 生成唯一的 nonce（防重放攻击的关键）
    // 格式：x402_ + 随机字符串
    const serverNonce = `x402_${Math.random().toString(36).substring(7)}`;

    // 将 nonce 与 eventId 关联存储（可选，用于额外验证）
    pendingNonces.set(serverNonce, eventId);

    // 返回 402 Payment Required 响应
    // 包含支付所需的所有信息
    return c.json({
        error: "402 Payment Required",  // 错误描述
        amount: "10 Tokens",            // 需要支付的金额
        destination: ORACLE_WALLET,     // 收款地址
        nonce: serverNonce              // 唯一标识符，必须包含在支付交易中
    }, 402);  // HTTP 状态码 402
});

// 启动服务器
console.log("Oracle running on http://localhost:3000");
// 使用 Hono 的 Node.js 适配器启动 HTTP 服务
serve({ fetch: app.fetch, port: 3000 });