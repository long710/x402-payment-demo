# 买方快速入门

本指南将引导你如何使用 **x402** 与需要支付的服务进行交互。完成本指南后，你将能够以编程方式发现支付要求、完成支付并访问付费资源。

### 前提条件

开始之前，请确保你具备：

* 持有 USDC 的加密钱包（任何 EVM 兼容钱包）
* 已安装 [Node.js](https://nodejs.org/en) 和 npm、[Go](https://go.dev/) 或 Python 和 pip
* 一个通过 x402 要求支付的服务

**注意**
我们在[仓库中提供了预配置的示例](https://github.com/coinbase/x402/tree/main/examples)，包括 fetch、Axios、Go 和 MCP 的示例。

### 1. 安装依赖

{% tabs %}
{% tab title="Node.js" %}
安装 x402 客户端包：

```bash
# 基于 fetch 的客户端
npm install @x402/fetch @x402/evm

# 基于 axios 的客户端
npm install @x402/axios @x402/evm

# 如需 Solana 支持，还需添加：
npm install @x402/svm
```

{% endtab %}

{% tab title="Go" %}
将 x402 Go 模块添加到你的项目：

```bash
go get github.com/coinbase/x402/go
```

{% endtab %}

{% tab title="Python" %}
安装 [x402 包](https://pypi.org/project/x402/)，选择你喜欢的 HTTP 客户端：

```bash
# httpx（异步）- 推荐
pip install "x402[httpx]"

# requests（同步）
pip install "x402[requests]"

# 如需 Solana 支持，还需添加：
pip install "x402[svm]"
```

{% endtab %}
{% endtabs %}

### 2. 创建钱包签名器

{% tabs %}
{% tab title="Node.js (viem)" %}
安装所需包：

```bash
npm install viem
```

然后实例化钱包签名器：

```typescript
import { privateKeyToAccount } from "viem/accounts";

// 从私钥创建签名器（使用环境变量）
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
```

{% endtab %}

{% tab title="Go" %}

```go
import (
    evmsigners "github.com/coinbase/x402/go/signers/evm"
)

// 从环境变量加载私钥
evmSigner, err := evmsigners.NewClientSignerFromPrivateKey(os.Getenv("EVM_PRIVATE_KEY"))
if err != nil {
    log.Fatal(err)
}
```

{% endtab %}

{% tab title="Python (eth-account)" %}
安装所需包：

```bash
pip install eth_account
```

然后实例化钱包签名器：

```python
import os
from eth_account import Account
from x402.mechanisms.evm import EthAccountSigner

account = Account.from_key(os.getenv("EVM_PRIVATE_KEY"))
signer = EthAccountSigner(account)
```

{% endtab %}
{% endtabs %}

#### Solana (SVM)

使用 [SolanaKit](https://www.solanakit.com/) 实例化签名器：

```typescript
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

// 64 字节 base58 密钥（私钥 + 公钥）
const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SOLANA_PRIVATE_KEY!)
);
```

### 3. 自动发起付费请求

{% tabs %}
{% tab title="Fetch" %}
**@x402/fetch** 扩展了原生 `fetch` API，为你处理 402 响应和支付头。[完整示例在这里](https://github.com/coinbase/x402/tree/main/examples/typescript/clients/fetch)

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// 创建签名器
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

// 创建 x402 客户端并注册 EVM 方案
const client = new x402Client();
registerExactEvmScheme(client, { signer });

// 用支付处理包装 fetch
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// 发起请求 - 支付自动处理
const response = await fetchWithPayment("https://api.example.com/paid-endpoint", {
  method: "GET",
});

const data = await response.json();
console.log("响应:", data);

// 从响应头获取支付收据
if (response.ok) {
  const httpClient = new x402HTTPClient(client);
  const paymentResponse = httpClient.getPaymentSettleResponse(
    (name) => response.headers.get(name)
  );
  console.log("支付已结算:", paymentResponse);
}
```

{% endtab %}

{% tab title="Axios" %}
**@x402/axios** 为 Axios 添加支付拦截器，你的请求会自动带上支付头重试。[完整示例在这里](https://github.com/coinbase/x402/tree/main/examples/typescript/clients/axios)

```typescript
import { x402Client, wrapAxiosWithPayment, x402HTTPClient } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import axios from "axios";

// 创建签名器
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

// 创建 x402 客户端并注册 EVM 方案
const client = new x402Client();
registerExactEvmScheme(client, { signer });

// 创建带支付处理的 Axios 实例
const api = wrapAxiosWithPayment(
  axios.create({ baseURL: "https://api.example.com" }),
  client,
);

// 发起请求 - 支付自动处理
const response = await api.get("/paid-endpoint");
console.log("响应:", response.data);

// 获取支付收据
const httpClient = new x402HTTPClient(client);
const paymentResponse = httpClient.getPaymentSettleResponse(
  (name) => response.headers[name.toLowerCase()]
);
console.log("支付已结算:", paymentResponse);
```

{% endtab %}

{% tab title="Go" %}
[完整示例在这里](https://github.com/coinbase/x402/tree/main/examples/go/clients/http)

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "time"

    x402 "github.com/coinbase/x402/go"
    x402http "github.com/coinbase/x402/go/http"
    evm "github.com/coinbase/x402/go/mechanisms/evm/exact/client"
    evmsigners "github.com/coinbase/x402/go/signers/evm"
)

func main() {
    url := "http://localhost:4021/weather"

    // 创建 EVM 签名器
    evmSigner, _ := evmsigners.NewClientSignerFromPrivateKey(os.Getenv("EVM_PRIVATE_KEY"))

    // 创建 x402 客户端并注册 EVM 方案
    x402Client := x402.Newx402Client().
        Register("eip155:*", evm.NewExactEvmScheme(evmSigner))

    // 用支付处理包装 HTTP 客户端
    httpClient := x402http.WrapHTTPClientWithPayment(
        http.DefaultClient,
        x402http.Newx402HTTPClient(x402Client),
    )

    // 发起请求 - 支付自动处理
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
    resp, err := httpClient.Do(req)
    if err != nil {
        fmt.Printf("请求失败: %v\n", err)
        return
    }
    defer resp.Body.Close()

    // 读取响应
    var data map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&data)
    fmt.Printf("响应: %+v\n", data)

    // 检查支付响应头
    paymentHeader := resp.Header.Get("PAYMENT-RESPONSE")
    if paymentHeader != "" {
        fmt.Println("支付结算成功！")
    }
}
```

{% endtab %}

{% tab title="Python (httpx)" %}
**httpx** 提供异步 HTTP 客户端支持，自动处理 402 支付。

[完整 HTTPX 示例](https://github.com/coinbase/x402/tree/main/examples/python/clients/httpx) | [完整 Requests 示例](https://github.com/coinbase/x402/tree/main/examples/python/clients/requests)

```python
import asyncio
import os
from eth_account import Account

from x402 import x402Client
from x402.http import x402HTTPClient
from x402.http.clients import x402HttpxClient
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client


async def main() -> None:
    client = x402Client()
    account = Account.from_key(os.getenv("EVM_PRIVATE_KEY"))
    register_exact_evm_client(client, EthAccountSigner(account))

    http_client = x402HTTPClient(client)

    async with x402HttpxClient(client) as http:
        response = await http.get("https://api.example.com/paid-endpoint")
        await response.aread()

        print(f"响应: {response.text}")

        if response.is_success:
            settle_response = http_client.get_payment_settle_response(
                lambda name: response.headers.get(name)
            )
            print(f"支付已结算: {settle_response}")


asyncio.run(main())
```

{% endtab %}

{% tab title="Python (requests)" %}
**requests** 提供同步 HTTP 客户端支持，自动处理 402 支付。

[完整 Requests 示例](https://github.com/coinbase/x402/tree/main/examples/python/clients/requests)

```python
import os
from eth_account import Account

from x402 import x402ClientSync
from x402.http import x402HTTPClientSync
from x402.http.clients import x402_requests
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client


def main() -> None:
    client = x402ClientSync()
    account = Account.from_key(os.getenv("EVM_PRIVATE_KEY"))
    register_exact_evm_client(client, EthAccountSigner(account))

    http_client = x402HTTPClientSync(client)

    with x402_requests(client) as session:
        response = session.get("https://api.example.com/paid-endpoint")

        print(f"响应: {response.text}")

        if response.ok:
            settle_response = http_client.get_payment_settle_response(
                lambda name: response.headers.get(name)
            )
            print(f"支付已结算: {settle_response}")


main()
```

{% endtab %}
{% endtabs %}

### 多网络客户端设置

你可以注册多个支付方案来处理不同的网络：

{% tabs %}
{% tab title="TypeScript" %}

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

// 创建签名器
const evmSigner = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SOLANA_PRIVATE_KEY!)
);

// 创建带多个方案的客户端
const client = new x402Client();
registerExactEvmScheme(client, { signer: evmSigner });
registerExactSvmScheme(client, { signer: svmSigner });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// 现在自动处理 EVM 和 Solana 网络！
```

{% endtab %}

{% tab title="Go" %}

```go
import (
    x402 "github.com/coinbase/x402/go"
    x402http "github.com/coinbase/x402/go/http"
    evm "github.com/coinbase/x402/go/mechanisms/evm/exact/client"
    svm "github.com/coinbase/x402/go/mechanisms/svm/exact/client"
    evmsigners "github.com/coinbase/x402/go/signers/evm"
    svmsigners "github.com/coinbase/x402/go/signers/svm"
)

// 创建签名器
evmSigner, _ := evmsigners.NewClientSignerFromPrivateKey(os.Getenv("EVM_PRIVATE_KEY"))
svmSigner, _ := svmsigners.NewClientSignerFromPrivateKey(os.Getenv("SVM_PRIVATE_KEY"))

// 创建带多个方案的客户端
x402Client := x402.Newx402Client().
    Register("eip155:*", evm.NewExactEvmScheme(evmSigner)).
    Register("solana:*", svm.NewExactSvmScheme(svmSigner))

// 用支付处理包装 HTTP 客户端
httpClient := x402http.WrapHTTPClientWithPayment(
    http.DefaultClient,
    x402http.Newx402HTTPClient(x402Client),
)

// 现在自动处理 EVM 和 Solana 网络！
```

{% endtab %}

{% tab title="Python" %}

```python
import asyncio
import os

from eth_account import Account

from x402 import x402Client
from x402.http.clients import x402HttpxClient
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client
from x402.mechanisms.svm import KeypairSigner
from x402.mechanisms.svm.exact.register import register_exact_svm_client


async def main() -> None:
    client = x402Client()

    # 注册 EVM 方案
    account = Account.from_key(os.getenv("EVM_PRIVATE_KEY"))
    register_exact_evm_client(client, EthAccountSigner(account))

    # 注册 SVM 方案
    svm_signer = KeypairSigner.from_base58(os.getenv("SVM_PRIVATE_KEY"))
    register_exact_svm_client(client, svm_signer)

    async with x402HttpxClient(client) as http:
        response = await http.get("https://api.example.com/paid-endpoint")
        print(f"响应: {response.text}")


asyncio.run(main())
```

{% endtab %}
{% endtabs %}

### 4. 发现可用服务（可选）

你可以使用 x402 Bazaar 动态发现可用服务，而不是硬编码端点。这对于构建自主代理特别有用。

```typescript
// 从 Bazaar API 获取可用服务
const response = await fetch(
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources"
);
const services = await response.json();

// 按条件筛选服务
const affordableServices = services.items.filter((item) =>
  item.accepts.some((req) => Number(req.amount) < 100000) // 低于 $0.10
);

console.log("可用服务:", affordableServices);
```

在 [Bazaar 文档](https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer)中了解更多关于服务发现的信息。

### 5. 错误处理

客户端会在以下情况抛出错误：

* 没有为所需网络注册方案
* 请求配置缺失
* 已经为该请求尝试过支付
* 创建支付头时出错

常见错误处理：

```typescript
try {
  const response = await fetchWithPayment(url, { method: "GET" });
  // 处理成功
} catch (error) {
  if (error.message.includes("No scheme registered")) {
    console.error("网络不支持 - 请注册相应的方案");
  } else if (error.message.includes("Payment already attempted")) {
    console.error("重试时支付失败");
  } else {
    console.error("请求失败:", error);
  }
}
```

### 总结

* 安装 x402 客户端包（`@x402/fetch` 或 `@x402/axios`）和机制包（`@x402/evm`、`@x402/svm`）
* 创建钱包签名器
* 创建 `x402Client` 并注册支付方案
* 使用提供的包装器/拦截器发起付费 API 请求
* （可选）使用 x402 Bazaar 动态发现服务
* 支付流程会自动为你处理

***

**参考资料：**

* [@x402/fetch on npm](https://www.npmjs.com/package/@x402/fetch)
* [@x402/axios on npm](https://www.npmjs.com/package/@x402/axios)
* [@x402/evm on npm](https://www.npmjs.com/package/@x402/evm)
* [x402 Go 模块](https://github.com/coinbase/x402/tree/main/go)
* [x402 Bazaar 文档](https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer) - 发现可用服务

如有问题或需要支持，请加入我们的 [Discord](https://discord.gg/invite/cdp)。
