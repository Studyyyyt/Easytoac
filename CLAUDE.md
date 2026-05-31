# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

激活码管理系统，基于 Next.js 14 (App Router) 开发。提供激活码的批量生成、验证（一码一机）、管理后台、数据统计等功能。支持 IP 白名单和 JWT 认证。

### 技术栈

- **框架**: Next.js 14 (App Router)
- **数据库**: SQLite3 + Prisma ORM
- **认证**: JWT (jose 库) + bcryptjs
- **UI**: Tailwind CSS
- **运行环境**: Node.js >= 18

## 常用命令

```bash
# 开发服务器
npm run dev                    # 启动于 http://localhost:3000

# 数据库操作
npm run db:generate            # 生成 Prisma Client
npm run db:push                # 将 schema 推送到数据库
npm run db:backup              # 执行数据库备份脚本
npm run db:backup-simple       # 简单备份：复制 dev.db 文件
npm run db:backup-sql          # 导出 SQL 格式的备份

# 系统初始化（首次部署或重置时需要）
npm run init-default-admin     # 创建默认管理员（admin / 123456）
npm run init-system-config     # 初始化系统配置表（IP 白名单、JWT 设置等）

# 构建与部署
npm run build                  # 生产构建
npm run start                  # 启动生产服务器
npm run lint                   # ESLint 检查
```

## 项目结构

```
src/
├── app/                        # Next.js App Router
│   ├── admin/                  # 管理后台页面
│   │   ├── login/             # 登录页
│   │   └── dashboard/         # 管理面板（统计、生成、管理）
│   ├── api/                    # API 路由
│   │   ├── admin/             # 管理接口（需认证）
│   │   │   ├── codes/         # 激活码 CRUD + 生成 + 统计
│   │   │   ├── login/         # 管理员登录
│   │   │   ├── logout/        # 登出
│   │   │   ├── change-password/
│   │   │   └── system-config/ # 系统配置管理
│   │   └── verify/            # 激活码验证接口（公开）
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # 首页
├── lib/                        # 工具库
│   ├── db.ts                  # Prisma Client 单例
│   ├── jwt.ts                 # JWT 签发与验证
│   ├── auth-middleware.ts     # API 路由认证中间件
│   └── config-service.ts      # 数据库配置服务（动态配置缓存）
├── config.ts                   # 系统主配置（数据库、JWT、安全）
└── middleware.ts               # Next.js 中间件（IP 白名单 + JWT 路由保护）

prisma/
├── schema.prisma               # 数据库模型定义
└── dev.db                      # SQLite 数据库文件

scripts/                        # 初始化与运维脚本
├── init-default-admin.ts
├── init-system-config.ts
├── backup-db.sh
└── restore-db.sh
```

## 架构要点

### 配置管理

- **不使用 `.env` 文件**，所有配置集中在 `src/config.ts` 中管理。
- 部分配置（如 IP 白名单、JWT 过期时间）支持通过数据库 `SystemConfig` 表动态管理，通过 `config-service.ts` 提供缓存读取。
- `src/config.ts` 中的 `security.allowedIPs` 仅用于中间件默认白名单；生产环境建议通过数据库配置动态管理。

### 认证与权限

- **中间件** (`src/middleware.ts`)：匹配 `/admin/*` 路径，执行 IP 白名单检查和 JWT cookie 存在性检查。
- **API 认证** (`src/lib/auth-middleware.ts`)：实际验证 JWT 签名和有效性，在 API 路由中调用。
- 登录成功后，JWT 通过 `httpOnly` cookie (`auth-token`) 传递，有效期默认 24 小时。
- 中间件中的 IP 白名单检查仅在 `NODE_ENV=production` 时生效，开发环境自动放行。

### 数据库模型

| 模型 | 作用 |
|------|------|
| `ActivationCode` | 激活码主表，含 code / isUsed / usedBy / validDays / cardType |
| `Admin` | 管理员账号，密码 bcrypt 哈希存储 |
| `SystemConfig` | 动态系统配置（key-value 形式） |

### 激活码过期逻辑（核心）

- **过期时间从激活时开始计算**，不是创建时间。
- 未激活的激活码不会过期（`expiresAt` 为 null，或按 `validDays` 在激活时计算）。
- 字段 `validDays` 存储有效天数，`cardType` 存储套餐类型（周卡/月卡/季卡/年卡等）。

### API 路由设计

- 管理后台 API 统一前缀 `/api/admin/*`，需通过 `verifyAuth` 中间件验证。
- 激活码验证接口为 `/api/verify`，无需认证，接受 `code` 和 `machine_id`。
- 响应格式：管理接口通常返回 `{ success: boolean, message?: string, data?: any }`；验证接口返回 `{ success: boolean, message: string, expires_at?: string }`。

## 开发注意事项

- **SQLite 数据库文件**：`prisma/dev.db` 是实际数据文件，提交到 git 会包含测试数据，生产部署时注意替换。
- **Prisma Client 单例**：`src/lib/db.ts` 中通过全局变量防止开发环境热重载时重复创建 Prisma Client 实例。
- **Server Components 外部包**：`next.config.js` 中配置了 `serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs']`，避免 Edge Runtime 兼容问题。
- **激活码生成**：使用 `crypto.randomBytes(8).toString('hex').toUpperCase()` 生成 16 位大写十六进制字符串，生成时通过循环检查确保唯一性。
- **首次部署流程**：`npm install` -> `npm run db:generate` -> `npm run db:push` -> `npm run init-default-admin` -> `npm run init-system-config` -> `npm run dev`

## 与口腔 SaaS 系统的对接

本项目作为 **独立授权验证服务** 与口腔门诊 SaaS 管理系统对接。

### 对接方式
- SaaS 后端通过 HTTP API 调用本服务的 `/api/verify` 接口验证诊所激活码。
- 每个诊所绑定一个激活码，激活码过期则该诊所所有用户无法登录。
- SaaS 后端 `LicenseVerificationService` 负责调用验证逻辑，支持网络异常时的本地过期时间容错。

### Docker 独立部署
```bash
# 在项目根目录执行
docker compose up -d
```
- 服务启动后访问管理后台：`http://localhost:3001/admin/login`
- 首次启动后需执行初始化：
  ```bash
  docker compose exec easytoac npx tsx scripts/init-default-admin.ts
  docker compose exec easytoac npx tsx scripts/init-system-config.ts
  ```
- SQLite 数据库通过 Docker Volume `license-server-data` 持久化。

### 验证接口
- **POST** `/api/verify`
- 请求体：`{ "code": "激活码", "machine_id": "saas-clinic-{诊所ID}" }`
- 成功响应：`{ "success": true, "message": "激活码验证成功", "expires_at": "2024-12-31T00:00:00.000Z" }`
- 失败响应：`{ "success": false, "message": "错误信息" }`
