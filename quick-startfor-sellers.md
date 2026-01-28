# 卖方快速入门

本指南将引导你集成 **x402**，为你的 API 或服务启用支付功能。完成后，你的 API 将能够向买方和 AI 代理收取访问费用。

**注意：** 本快速入门从测试网配置开始，以便安全测试。当你准备好投入生产时，请参阅[在主网运行](#在主网运行)了解接受 Base (EVM) 和 Solana 网络真实支付所需的简单更改。

### 前提条件

开始之前，请确保你具备：

* 用于接收资金的加密钱包（任何 EVM 兼容钱包）
* 已安装 [Node.js](https://nodejs.org/en) 和 npm、[Go](https://go.dev/) 或 Python 和 pip
* 现有的 API 或服务器

**注意**
我们在仓库中提供了 [Node.js](https://github.com/coinbase/x402/tree/main/examples/typescript/servers) 和 [Go](https://github.com/coinbase/x402/tree/main/examples/go/servers) 的预配置示例。我们还有一个[高级示例](https://github.com/coinbase/x402/tree/main/examples/typescript/servers/advanced)，展示如何使用 x402 SDK 构建更复杂的支付流程。

### 1. 安装依赖

{% tabs %}
{% tab title="Express" %}
安装 [x402 Express 中间件包](https://www.npmjs.com/package/@x402/express)。

```bash
npm install @x402/express @x402/core @x402/evm
```

{% endtab %}

{% tab title="Next.js" %}
安装 [x402 Next.js 中间件包](https://www.npmjs.com/package/@x402/next)。

```bash
npm install @x402/next @x402/core @x402/evm
```

{% endtab %}

{% tab title="Hono" %}
安装 [x402 Hono 中间件包](https://www.npmjs.com/package/@x402/hono)。

```bash
npm install @x402/hono @x402/core @x402/evm
```

{% endtab %}

{% tab title="Go" %}
将 x402 Go 模块添加到你的项目：

```bash
go get github.com/coinbase/x402/go
```

{% endtab %}

{% tab title="FastAPI" %}
[安装支持 FastAPI 的 x402 Python 包](https://pypi.org/project/x402/)：

```bash
pip install "x402[fastapi]"

# 如需 Solana 支持，还需添加：
pip install "x402[svm]"
```

{% endtab %}

{% tab title="Flask" %}
[安装支持 Flask 的 x402 Python 包](https://pypi.org/project/x402/)：

```bash
pip install "x402[flask]"

# 如需 Solana 支持，还需添加：
pip install "x402[svm]"
```

{% endtab %}
{% endtabs %}

### 2. 添加支付中间件

将支付中间件集成到你的应用程序中。你需要提供：

* Facilitator URL 或 facilitator 客户端。测试时使用 `https://x402.org/facilitator`，它支持 Base Sepolia 和 Solana devnet。
  * 主网设置请参阅[在主网运行](#在主网运行)
* 你想要保护的路由
* 你的收款钱包地址

{% tabs %}
{% tab title="Express" %}
完整示例在仓库[这里](https://github.com/coinbase/x402/tree/main/examples/typescript/servers/express)。

```typescript
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const app = express();

// 你的收款钱包地址
const payTo = "0xYourAddress";

// 创建 facilitator 客户端（测试网）
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator"
});

// 创建资源服务器并注册 EVM 方案
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001", // USDC 金额（美元）
            network: "eip155:84532", // Base Sepolia（CAIP-2 格式）
            payTo,
          },
        ],
        description: "获取任意位置的当前天气数据",
        mimeType: "application/json",
      },
    },
    server,
  ),
);

// 实现你的路由
app.get("/weather", (req, res) => {
  res.send({
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

app.listen(4021, () => {
  console.log(`服务器监听于 http://localhost:4021`);
});
```

{% endtab %}

{% tab title="Next.js" %}
完整示例在仓库[这里](https://github.com/coinbase/x402/tree/main/examples/typescript/fullstack/next)。

```typescript
// middleware.ts
import { paymentProxy } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const payTo = "0xYourAddress";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator"
});

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

export const middleware = paymentProxy(
  {
    "/api/protected": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.01",
          network: "eip155:84532",
          payTo,
        },
      ],
      description: "访问受保护的内容",
      mimeType: "application/json",
    },
  },
  server,
);

export const config = {
  matcher: ["/api/protected/:path*"],
};
```

{% endtab %}

{% tab title="Hono" %}
完整示例在仓库[这里](https://github.com/coinbase/x402/tree/main/examples/typescript/servers/hono)。

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const app = new Hono();
const payTo = "0xYourAddress";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator"
});

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

app.use(
  paymentMiddleware(
    {
      "/protected-route": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.10",
            network: "eip155:84532",
            payTo,
          },
        ],
        description: "访问高级内容",
        mimeType: "application/json",
      },
    },
    server,
  ),
);

app.get("/protected-route", (c) => {
  return c.json({ message: "此内容位于付费墙后" });
});

serve({ fetch: app.fetch, port: 3000 });
```

{% endtab %}

{% tab title="Go (Gin)" %}
完整示例在仓库[这里](https://github.com/coinbase/x402/tree/main/examples/go/servers/gin)。

```go
package main

import (
    "net/http"
    "time"

    x402 "github.com/coinbase/x402/go"
    x402http "github.com/coinbase/x402/go/http"
    ginmw "github.com/coinbase/x402/go/http/gin"
    evm "github.com/coinbase/x402/go/mechanisms/evm/exact/server"
    "github.com/gin-gonic/gin"
)

func main() {
    payTo := "0xYourAddress"
    network := x402.Network("eip155:84532") // Base Sepolia（CAIP-2 格式）

    r := gin.Default()

    // 创建 facilitator 客户端
    facilitatorClient := x402http.NewHTTPFacilitatorClient(&x402http.FacilitatorConfig{
        URL: "https://x402.org/facilitator",
    })

    // 应用 x402 支付中间件
    r.Use(ginmw.X402Payment(ginmw.Config{
        Routes: x402http.RoutesConfig{
            "GET /weather": {
                Accepts: x402http.PaymentOptions{
                    {
                        Scheme:  "exact",
                        PayTo:   payTo,
                        Price:   "$0.001",
                        Network: network,
                    },
                },
                Description: "获取城市天气数据",
                MimeType:    "application/json",
            },
        },
        Facilitator: facilitatorClient,
        Schemes: []ginmw.SchemeConfig{
            {Network: network, Server: evm.NewExactEvmScheme()},
        },
        SyncFacilitatorOnStart: true,
        Timeout:    30 * time.Second,
    }))

    // 受保护的端点
    r.GET("/weather", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "weather":     "sunny",
            "temperature": 70,
        })
    })

    r.Run(":4021")
}
```

{% endtab %}

{% tab title="FastAPI" %}
完整示例在仓库[这里](https://github.com/coinbase/x402/tree/main/examples/python/servers/fastapi)。

```python
from typing import Any

from fastapi import FastAPI

from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.server import x402ResourceServer

app = FastAPI()

# 你的收款钱包地址
pay_to = "0xYourAddress"

# 创建 facilitator 客户端（测试网）
facilitator = HTTPFacilitatorClient(
    FacilitatorConfig(url="https://x402.org/facilitator")
)

# 创建资源服务器并注册 EVM 方案
server = x402ResourceServer(facilitator)
server.register("eip155:84532", ExactEvmServerScheme())

# 定义受保护的路由
routes: dict[str, RouteConfig] = {
    "GET /weather": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=pay_to,
                price="$0.001",  # USDC 金额（美元）
                network="eip155:84532",  # Base Sepolia（CAIP-2 格式）
            ),
        ],
        mime_type="application/json",
        description="获取任意位置的当前天气数据",
    ),
}

# 添加支付中间件
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)


@app.get("/weather")
async def get_weather() -> dict[str, Any]:
    return {
        "report": {
            "weather": "sunny",
            "temperature": 70,
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4021)
```

{% endtab %}

{% tab title="Flask" %}
完整示例在仓库[这里](https://github.com/coinbase/x402/tree/main/examples/python/servers/flask)。

```python
from flask import Flask, jsonify

from x402.http import FacilitatorConfig, HTTPFacilitatorClientSync, PaymentOption
from x402.http.middleware.flask import payment_middleware
from x402.http.types import RouteConfig
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.server import x402ResourceServerSync

app = Flask(__name__)

pay_to = "0xYourAddress"

facilitator = HTTPFacilitatorClientSync(
    FacilitatorConfig(url="https://x402.org/facilitator")
)

server = x402ResourceServerSync(facilitator)
server.register("eip155:84532", ExactEvmServerScheme())

routes: dict[str, RouteConfig] = {
    "GET /weather": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=pay_to,
                price="$0.001",
                network="eip155:84532",
            ),
        ],
        mime_type="application/json",
        description="获取任意位置的当前天气数据",
    ),
}

payment_middleware(app, routes=routes, server=server)


@app.route("/weather")
def get_weather():
    return jsonify({
        "report": {
            "weather": "sunny",
            "temperature": 70,
        }
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4021)
```

{% endtab %}
{% endtabs %}

**路由配置接口：**

```typescript
interface RouteConfig {
  accepts: Array<{
    scheme: string;           // 支付方案（如 "exact"）
    price: string;            // 美元价格（如 "$0.01"）
    network: string;          // CAIP-2 格式的网络（如 "eip155:84532"）
    payTo: string;            // 你的钱包地址
  }>;
  description?: string;       // 资源描述
  mimeType?: string;          // 响应的 MIME 类型
  extensions?: object;        // 可选扩展（如 Bazaar）
}
```

当请求到达这些路由但没有支付时，你的服务器将返回 HTTP 402 Payment Required 代码和支付说明。

### 3. 测试你的集成

验证步骤：

1. 向你的端点发送请求（如 `curl http://localhost:4021/weather`）
2. 服务器返回 402 Payment Required，在 `PAYMENT-REQUIRED` 头中包含支付说明
3. 使用兼容的客户端、钱包或自动化代理完成支付。这通常涉及签署支付载荷，由[买方快速入门](https://x402.gitbook.io/x402/getting-started/quickstart-for-buyers)中详述的客户端 SDK 处理
4. 重试请求，这次在 `PAYMENT-SIGNATURE` 头中包含支付的加密证明
5. 服务器通过 facilitator 验证支付，如果有效，返回你的实际 API 响应（如 `{ "data": "你的付费 API 响应。" }`）

### 4. 通过元数据增强发现（推荐）

使用 CDP facilitator 时，你的端点可以在 [x402 Bazaar](https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer) 中列出，这是我们的发现层，帮助买方和 AI 代理找到服务。要启用发现：

```typescript
{
  "GET /weather": {
    accepts: [
      {
        scheme: "exact",
        price: "$0.001",
        network: "eip155:8453",
        payTo: "0xYourAddress",
      },
    ],
    description: "获取实时天气数据，包括温度、天气状况和湿度",
    mimeType: "application/json",
    extensions: {
      bazaar: {
        discoverable: true,
        category: "weather",
        tags: ["forecast", "real-time"],
      },
    },
  },
}
```

在 [Bazaar 文档](https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer)中了解更多关于发现层的信息。

### 5. 错误处理

* 如果遇到问题，请查看[仓库](https://github.com/coinbase/x402/tree/main/examples)中的示例获取更多上下文和完整代码
* 运行 `npm install` 或 `go mod tidy` 安装依赖

***

## 在主网运行

在测试网测试完集成后，你就可以在主网接受真实支付了。

### 1. 更新 Facilitator URL

主网使用 CDP facilitator：

{% tabs %}
{% tab title="Node.js" %}

```typescript
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://api.cdp.coinbase.com/platform/v2/x402"
});
```

{% endtab %}

{% tab title="Go" %}

```go
facilitatorClient := x402http.NewHTTPFacilitatorClient(&x402http.FacilitatorConfig{
    URL: "https://api.cdp.coinbase.com/platform/v2/x402",
})
```

{% endtab %}

{% tab title="Python (FastAPI)" %}

```python
from x402.http import FacilitatorConfig, HTTPFacilitatorClient

facilitator = HTTPFacilitatorClient(
    FacilitatorConfig(url="https://api.cdp.coinbase.com/platform/v2/x402")
)
```

{% endtab %}

{% tab title="Python (Flask)" %}

```python
from x402.http import FacilitatorConfig, HTTPFacilitatorClientSync

facilitator = HTTPFacilitatorClientSync(
    FacilitatorConfig(url="https://api.cdp.coinbase.com/platform/v2/x402")
)
```

{% endtab %}
{% endtabs %}

### 2. 更新网络标识符

从测试网更改为主网网络标识符：

{% tabs %}
{% tab title="Base 主网" %}

```typescript
// 测试网 → 主网
network: "eip155:8453", // Base 主网（原 eip155:84532）
```

{% endtab %}

{% tab title="Solana 主网" %}

```typescript
// 测试网 → 主网
network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", // Solana 主网

// 对于 Solana，使用 Solana 钱包地址（base58 格式）
payTo: "YourSolanaWalletAddress",
```

{% endtab %}

{% tab title="多网络" %}

```typescript
// 在同一端点支持多个网络
{
  "GET /weather": {
    accepts: [
      {
        scheme: "exact",
        price: "$0.001",
        network: "eip155:8453",  // Base 主网
        payTo: "0xYourEvmAddress",
      },
      {
        scheme: "exact",
        price: "$0.001",
        network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",  // Solana 主网
        payTo: "YourSolanaAddress",
      },
    ],
    description: "天气数据",
  },
}
```

{% endtab %}
{% endtabs %}

### 3. 注册多个方案（多网络）

如需多网络支持，注册 EVM 和 SVM 方案：

{% tabs %}
{% tab title="Node.js" %}

```typescript
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);
registerExactSvmScheme(server);
```

{% endtab %}

{% tab title="Go" %}

```go
import (
    evm "github.com/coinbase/x402/go/mechanisms/evm/exact/server"
    svm "github.com/coinbase/x402/go/mechanisms/svm/exact/server"
)

r.Use(ginmw.X402Payment(ginmw.Config{
    // ...
    Schemes: []ginmw.SchemeConfig{
        {Network: x402.Network("eip155:8453"), Server: evm.NewExactEvmScheme()},
        {Network: x402.Network("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"), Server: svm.NewExactSvmScheme()},
    },
}))
```

{% endtab %}

{% tab title="Python" %}

```python
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.mechanisms.svm.exact import ExactSvmServerScheme
from x402.server import x402ResourceServer

server = x402ResourceServer(facilitator)
server.register("eip155:8453", ExactEvmServerScheme())  # Base 主网
server.register("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", ExactSvmServerScheme())  # Solana 主网
```

{% endtab %}
{% endtabs %}

### 4. 更新你的钱包

确保你的收款钱包地址是你想要接收 USDC 支付的真实主网地址。

### 5. 使用真实支付测试

上线前：

1. 先用小额测试
2. 验证支付是否到达你的钱包
3. 监控 facilitator 是否有问题

**警告：** 主网交易涉及真实资金。务必先在测试网充分测试，并在主网从小额开始。

***

## 网络标识符 (CAIP-2)

x402 v2 使用 [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) 格式的网络标识符：

| 网络 | CAIP-2 标识符 |
| --- | --- |
| Base 主网 | `eip155:8453` |
| Base Sepolia | `eip155:84532` |
| Solana 主网 | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |

完整列表请参阅[网络支持](https://x402.gitbook.io/x402/core-concepts/network-and-token-support)。

***

### 下一步

* 想要更高级的内容？查看[高级示例](https://github.com/coinbase/x402/tree/main/examples/typescript/servers/advanced)
* 作为[买方](https://x402.gitbook.io/x402/getting-started/quickstart-for-buyers)开始
* 了解 [Bazaar 发现层](https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer)

如有问题或需要支持，请加入我们的 [Discord](https://discord.gg/invite/cdp)。

### 总结

本快速入门涵盖了：

* 安装 x402 SDK 和相关中间件
* 向 API 添加支付中间件并配置
* 测试你的集成
* 使用 CAIP-2 网络标识符部署到主网

你的 API 现在已准备好通过 x402 接受加密支付。
