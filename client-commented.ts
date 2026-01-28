// ============================================================================
// client.ts - x402 客户端（市场方）
// 功能：请求付费 API，处理 402 响应，完成链上支付，提交支付证明
// ============================================================================

// 引入 axios 用于发送 HTTP 请求
import axios from 'axios';
// 引入 ethers.js 用于与区块链交互
import { ethers } from 'ethers';

// BSC 主网的 RPC 节点地址，用于连接区块链网络
const BSC_RPC = "https://bsc-dataseed.binance.org/";
// 创建 JSON-RPC Provider，这是与区块链通信的桥梁
const provider = new ethers.JsonRpcProvider(BSC_RPC);

// --- 配置 ---
// 客户端钱包的私钥（用于签名交易）
// 注意：生产环境中绝对不要硬编码私钥！
const PRIVATE_KEY = "0x33c2fe6415e7179b5f0f461a32cbb179af3dd42fbe502a288a40ef3414315661";
// ERC-20 代币合约地址（用于支付的代币）
const TOKEN_ADDRESS = "0xe4a47ca9be22b07ea37dbe6cb7479d7ef2f18548";
// 使用私钥创建钱包实例，并连接到 provider
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// ERC-20 代币合约的 ABI（应用二进制接口）
// 只定义了我们需要用到的三个函数
const abi = [
    // transfer: 转账函数，将代币从当前账户转到指定地址
    "function transfer(address to, uint256 amount) public returns (bool)",
    // balanceOf: 查询指定地址的代币余额
    "function balanceOf(address account) public view returns (uint256)",
    // decimals: 查询代币精度（小数位数，通常是 18）
    "function decimals() public view returns (uint8)"
];
// 创建代币合约实例，用于调用合约方法
const tokenContract = new ethers.Contract(TOKEN_ADDRESS, abi, wallet);

/**
 * 主函数：执行市场结算流程
 * @param eventId - 事件ID，用于标识要查询的数据
 */
async function runMarketSettlement(eventId: string) {
    // 构造 API 请求地址
    const url = `http://localhost:3000/api/price/${eventId}`;

    try {
        // ========== 第一步：尝试直接请求 API ==========
        console.log("1. 尝试获取价格...");
        // 发送 GET 请求，不带任何认证信息
        const initialRes = await axios.get(url);
        // 如果成功，说明已有有效收据（这种情况在首次请求时不会发生）
        console.log("✅ 意外成功（已有收据）:", initialRes.data.price);

    } catch (error: any) {
        // ========== 第二步：处理 402 Payment Required 响应 ==========
        // 检查是否是 402 状态码（需要支付）
        if (error.response?.status === 402) {
            console.warn(`\n[402] 捕获到支付请求。开始准备 BSC 链上支付...`);

            // --- A. 检查余额与代币精度 ---
            // 并行查询三个信息以提高效率
            const [decimals, balance, bnbBalance] = await Promise.all([
                tokenContract.decimals(),           // 代币精度（小数位数）
                tokenContract.balanceOf(wallet.address),  // 代币余额
                provider.getBalance(wallet.address)       // BNB 余额（用于支付 Gas）
            ]);

            // 从 402 响应中解构出支付信息
            // nonce: 服务端生成的唯一标识符，用于防重放
            // destination: 收款地址（Oracle 钱包）
            // amount: 需要支付的金额（字符串格式）
            const { nonce, destination, amount: requiredAmountStr } = error.response.data;

            // 将支付金额转换为链上格式（考虑代币精度）
            // 例如：10 个代币，精度 18，则实际值为 10 * 10^18
            const payAmount = ethers.parseUnits("10", decimals);

            // 打印账户信息，方便调试
            console.log(`-------------------------------------------`);
            console.log(`🔹 账户地址: ${wallet.address}`);
            // formatUnits 将链上大数转换为人类可读格式
            console.log(`🔹 代币余额: ${ethers.formatUnits(balance, decimals)}`);
            // formatEther 专门用于 18 位精度的转换（BNB 精度是 18）
            console.log(`🔹 BNB 余额 : ${ethers.formatEther(bnbBalance)}`);
            console.log(`-------------------------------------------`);

            // 检查代币余额是否足够支付
            if (balance < payAmount) {
                console.error("❌ 错误: 代币余额不足以支付 10 个单位。请充值后再试。");
                return; // 余额不足，终止流程
            }
            // 检查 BNB 余额是否足够支付 Gas 费
            // 0.0005 BNB 大约是一笔简单交易的 Gas 费用
            if (bnbBalance < ethers.parseEther("0.0005")) {
                console.error("❌ 错误: BNB 余额不足以支付 Gas 费。");
                return; // Gas 不足，终止流程
            }

            // --- B. 构造交易数据并发送 ---
            console.log(`2. 执行支付中... Nonce: ${nonce}`);

            // 【关键技术点】将 nonce 字符串转换为十六进制格式
            // 例如："x402_abc" -> "0x783430325f616263"
            const nonceHex = ethers.hexlify(ethers.toUtf8Bytes(nonce));

            // 编码 ERC-20 transfer 函数调用
            // 这会生成标准的 calldata：函数选择器(4字节) + to地址(32字节) + amount(32字节)
            const baseData = tokenContract.interface.encodeFunctionData("transfer", [destination, payAmount]);

            // 【核心创新】将 nonce 附加到 calldata 末尾
            // ERC-20 合约只读取前 68 字节，后面的数据会被忽略
            // 但这些数据会被永久记录在链上，服务端可以验证
            const txData = ethers.concat([baseData, nonceHex]);

            try {
                // ========== 第三步：发送链上交易 ==========
                const tx = await wallet.sendTransaction({
                    to: TOKEN_ADDRESS,  // 发送到代币合约地址
                    data: txData,       // 包含 transfer 调用 + nonce 的数据
                    // 手动指定 Gas 限制，避免因为额外数据导致估算失败
                    gasLimit: 100000
                });

                // 交易已提交到内存池
                console.log(`✅ 支付已发送！哈希: ${tx.hash}`);
                console.log("⏳ 等待 BSC 确认中...");

                // 等待交易被打包进区块（确认）
                await tx.wait();

                // --- C. 提交支付证明 ---
                // ========== 第四步：携带支付证明重新请求 API ==========
                console.log("3. 提交证明并获取结果...");
                const finalRes = await axios.get(url, {
                    headers: {
                        // 交易哈希作为支付证明
                        'x-402-payment-proof': tx.hash,
                        // 原始 nonce，用于服务端验证
                        'x-402-nonce': nonce
                    }
                });

                // 成功获取数据！
                console.log("\n🎉 最终价格结果:", finalRes.data.price);
                // 服务端返回的 JWT 收据，可用于后续请求
                console.log("🎫 收据:", finalRes.data.receipt.slice(0, 30) + "...");

            } catch (txError: any) {
                // 交易执行失败的错误处理
                console.error("❌ 交易执行失败，请检查合约是否支持在 Data 中附加 Nonce");
                console.error("错误详情:", txError.reason || txError.message);
            }
        }
        // 如果不是 402 错误，这里可以添加其他错误处理
    }
}

// 执行主函数，查询 "match_final_001" 事件的价格
runMarketSettlement("match_final_001");