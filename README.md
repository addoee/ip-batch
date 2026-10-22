# IP / 域名 查询工具（IPv4 / IPv6 / WHOIS）

一个**单文件、零依赖、纯前端**的 IP 归属地与域名信息查询工具。双击 `index.html` 就能用，不需要构建、不需要后端、不需要起服务器。

**在线使用：<https://addoee.github.io/ip-batch/>**（GitHub Pages）

两个标签页：

- **IP 批量查询** —— 批量查 IP 归属地，IPv4 / IPv6 通吃
- **域名反查 / WHOIS** —— 域名 → A/AAAA/CNAME，加注册商、注册/到期时间、NS、域名状态

> 起因：网上常见的批量 IP 查询工具（如 lwebapp 的离线版）基于 ip2region 的 WASM 离线库，只能查 IPv4。本项目改为并发调用在线接口，**IPv4 与 IPv6 走同一套流程**。

## 特性

**IP 批量查询**

- **IPv4 + IPv6 全支持**，IPv6 自动归一化为压缩形式（`2408:8000:0:0:0:0:0:1` → `2408:8000::1`），并标注所属 `/64` 网段
- **多种输入格式**：换行、逗号、空格、分号分隔均可；支持带端口（`1.1.1.1:80`、`[2001:db8::1]:443`）；自动去重
- **CIDR 展开**：如 `1.1.1.0/24`、`240e:0:8000::/126`（上限 4096 条，IPv4 ≤/20、IPv6 ≥/116）
- **并发池 + 可中断**：并发数可调（默认 6），实时进度、预计剩余时间、随时停止
- **多数据源 + 自动降级**：纯真 → ipwho.is → ip.sb → ipinfo.io
- **本地缓存**：结果按 IP 缓存在 localStorage（7 天），重复查询不消耗接口额度
- **结果处理**：按任意列排序、按关键字/版本/状态筛选，导出 CSV（带 BOM，Excel 直接打开）/ JSON / 复制为 TSV
- **非法输入不静默**：无法解析的条目会单独列出并标注原因（如「网段过大」「不是合法 IP」）

**域名反查 / WHOIS**

- **DNS over HTTPS**：A / AAAA / CNAME 一次查全，可选 Google / 阿里 / Cloudflare 三个解析源
- **WHOIS 走 RDAP**：注册商、注册人、注册时间、到期时间（带剩余天数，30 天内标红）、域名状态、NS 列表
- **域名直接跳到 IP 查询**：点任意 IP chip，或点「把这 N 个 IP 拿去查归属地」，自动切到 IP 页并开始查询
- **`.cn` 明确提示**：该后缀注册局没有 RDAP，页面会给出站长之家的直链
- 支持批量、自动去协议/路径/端口、中文域名自动转 punycode

## 使用方法

**方式一：在线用** —— 直接打开 <https://addoee.github.io/ip-batch/>

**方式二：本地用** —— 下载或 clone 本仓库，双击 `index.html`（或拖进浏览器）

然后在对应标签页粘贴内容 → 点「开始查询」。

页面上还提供了几个自检/分享用的参数：

| 参数 | 作用 |
|---|---|
| `?demo=1` | 自动填入示例 IP 并立即查询 |
| `?ips=1.1.1.1\|8.8.8.8\|2408:8000::1` | 预填指定 IP（`\|` 作换行）并查询 |
| `?src=whois` | 指定 IP 数据源（`zxinc` / `whois` / `ipsb` / `ipinfo` / `auto`） |
| `?d=github.com\|baidu.com` | 打开域名页并查询这些域名（`\|` 作换行） |
| `?d=xxx.com&nowhois=1` | 只查 DNS，不查 WHOIS |
| `#domain` | 直接定位到域名页 |

快捷键：`Ctrl / ⌘ + Enter` 开始查询。

## 数据源

### IP 归属地

| 接口 | IPv6 | 跨域（CORS） | 说明 |
|---|---|---|---|
| [`ip.zxinc.org`](https://ip.zxinc.org/) | ✅ | 回显 Origin（含 `null`），`file://` 直开可用 | 纯真社区版 IPv4 + 自维护 ZXinc_IPv6，中文精度最好；官方公告未登录约 100 次/天 |
| [`ipwho.is`](https://ipwho.is/) | ✅ | `*` | 国外库，中文精度略低，但基本不限流 |
| [`api.ip.sb`](https://ip.sb/) | ✅ | `*` | 含 ASN / 运营商字段 |
| [`ipinfo.io`](https://ipinfo.io/) | ✅ | `*` | 需要 token 才能上量，页面里可填 |

> 浏览器端直接 `fetch`，不带自定义请求头，避免触发 preflight（纯真接口未返回 `Access-Control-Allow-Headers`）。

### 域名 DNS（DoH JSON）

| 接口 | 跨域 | 备注 |
|---|---|---|
| `dns.google/resolve` | `*` | 默认，返回完整 CNAME + A 链 |
| `dns.alidns.com/resolve` | `*` | 国内解析结果 |
| `cloudflare-dns.com/dns-query` | `*` | **必须带 `Accept: application/dns-json`**，否则 400（`Accept` 属 CORS 安全头，不触发 preflight） |

### 域名 WHOIS（RDAP）

RDAP 是 WHOIS 的 JSON 版继任协议，免费、无 key、结构化。实测可用且 CORS 为 `*` 的注册局：

| 后缀 | RDAP 端点 |
|---|---|
| .com / .net | `rdap.verisign.com` |
| .org | `rdap.publicinterestregistry.org` |
| .dev / .app | `pubapi.registry.google` |
| .io / .me | `rdap.identitydigital.services` |
| .top | `rdap.zdnsgtld.com` |
| .xyz | `rdap.centralnic.com` |
| 其他 | 兜底走 `rdap.org` 的 bootstrap 跳转 |

**`.cn` 查不了**：IANA 的 RDAP bootstrap 表里没有 cn，CNNIC 也没提供 RDAP 接口，浏览器又无法直连 whois 的 43 端口，所以纯前端不可能查到 `.cn` 的 WHOIS —— 页面对此会明确提示并给出替代链接。要覆盖 `.cn` 必须加后端 whois 代理。

## 大数据量怎么办

在线接口都有频次限制，几千条以上建议走离线库：下载 `ipv6wry.db`（ZXinc IPv6）+ `qqwry.dat`（纯真 IPv4），解析后导入 SQLite 本地查询，几万条是秒级。域名侧可自建 whois 代理或批量用 `dnsx` / `massdns`。

## 测试

纯函数（IP 解析、IPv6 压缩/展开、CIDR 掩码、结果归一化、CSV 转义、域名校验、RDAP/vCard 解析、DoH 解析）抽在 `index.html` 的 `CORE START / CORE END` 区块内，可独立测试：

```bash
node test-core.js
# 通过 97 / 97
```

## 致谢

- [纯真 IP 库社区版（ip.zxinc.org）](https://ip.zxinc.org/)：多年免费开放查询接口与 IPv6 地址库，是本项目的主要数据来源
- [lwebapp · IP 地址批量查询](https://lwebapp.com/zh/ip-batch)：离线批量查询工具，本项目的灵感来源

这两个社区工具无偿开放，本项目才得以存在。域名部分的数据来自各注册局的 RDAP 公开接口与 Google / 阿里 / Cloudflare 的 DoH 服务，一并致谢。

## 免责说明

本项目仅做前端聚合，IP 归属地与域名注册数据版权归各数据提供方所有。请遵守各接口的使用条款与频次限制，不要用于高频抓取。
