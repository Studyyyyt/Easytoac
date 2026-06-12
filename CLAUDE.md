# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

激活码管理系统，基于 Next.js 14 (App Router) 开发。提供激活码的批量生成、验证（一码一机）、管理后台、数据统计等功能。支持 IP 白名单和 JWT 认证。

本项目作为 **独立授权验证服务** 与口腔门诊 SaaS 管理系统对接。SaaS 后端通过 HTTP API 调用本服务的 `/api/verify` 接口验证诊所激活码。

### 技术栈

- **框架**: Next.js 14 (App Router)
- **数据库**: SQLite3 + Prisma ORM
- **认证**: JWT (jose 库) + bcryptjs
- **UI**: Tailwind CSS
- **运行环境**: Node.js >= 18
- **脚本运行**: tsx（TypeScript 直接执行，无需预编译）

## 常用命令

```bash
# 开发
npm run dev                    # 启动开发服务器于 http://localhost:3000

# 数据库
npm run db:generate            # 生成 Prisma Client
npm run db:push                # 将 schema 推送到数据库
npm run db:backup              # 执行数据库备份脚本（输出到 backups/）
npm run db:backup-simple       # 简单备份：复制 dev.db 文件（带时间戳）
npm run db:backup-sql          # 导出 SQL 格式的备份

# 系统初始化（首次部署或重置时需要）
npm run init-default-admin     # 创建默认管理员（admin / 123456）
npm run init-system-config     # 初始化系统配置表（IP 白名单、JWT 设置等）

# 构建与部署
npm run build                  # 生产构建
npm run start                  # 启动生产服务器
npm run lint                   # ESLint 检查

# Docker（推荐新手使用）
```bash
npm run docker:manage build    # 首次构建并启动
npm run docker:manage rebuild  # 修改代码后重建（自动备份数据 → 重建镜像 → 启动 → 健康检查）
npm run docker:manage restart  # 仅重启容器
npm run docker:manage stop     # 停止容器
npm run docker:manage logs     # 查看实时日志
npm run docker:manage shell    # 进入容器内部
npm run docker:manage backup   # 手动备份 SQLite 数据库到 ./backups/
npm run docker:manage export   # 导出镜像为 tar 包到 ./deploy/images/
npm run docker:manage load     # 从 ./deploy/images/easytoac-latest.tar 导入镜像
npm run docker:manage package  # 生成交付包（构建无缓存镜像 + 部署文件到 ./deploy/）
npm run docker:manage clean    # 清理无用镜像和卷
npm run docker:manage status   # 查看容器状态和最近备份
```

也支持直接使用 `bash scripts/docker-manage.sh [命令]`。

> 提示：`rebuild` 命令会在重建前自动备份 `./data/prisma/dev.db` 到 `./backups/dev.db.backup_YYYYMMDD_HHMMSS`，避免数据丢失。

## 镜像导出与迁移部署

### 方式一：完整交付包（推荐交给用户）

修改代码后，一键生成包含最新镜像和部署文件的交付包：

```bash
npm run docker:package
# 或直接运行脚本
./scripts/docker-manage.sh package
```

该命令会：

1. **强制不使用缓存构建最新镜像**（确保包含最新代码）
2. 导出镜像到 `images/easytoac-latest.tar`
3. 复制 `docker-compose.yml`、`Dockerfile`、`scripts/`、数据目录等部署所需文件
4. 生成用户一键启动脚本 `start.sh`
5. 打包为 `./deploy/easytoac-deploy-YYYYMMDD_HHMMSS.tar.gz`

用户收到交付包后，只需执行：

```bash
tar -xzf easytoac-deploy-YYYYMMDD_HHMMSS.tar.gz
cd easytoac-deploy-YYYYMMDD_HHMMSS
./start.sh
```

服务启动后访问 `http://localhost:3001/admin/login`，默认账号 `admin / 123456`。

### 方式二：仅导出镜像（适合已有项目文件的环境）

当需要将项目部署到没有 Docker 构建环境的服务器时，先在本地导出镜像：

```bash
npm run docker:export
```

导出结果：

- `./deploy/images/easytoac-YYYYMMDD_HHMMSS.tar` — 带时间戳的备份版本
- `./deploy/images/easytoac-latest.tar` — 最新版本的副本，便于脚本化操作

在目标服务器上，将 tar 文件复制过去后执行：

```bash
npm run docker:load
# 或直接使用 docker
# docker load -i ./deploy/images/easytoac-latest.tar
```

导入后，使用 `docker compose up -d` 启动服务即可。

注意：`load` 只导入应用镜像，目标服务器仍需准备 `docker-compose.yml`、 `./data/prisma/` 数据目录和 `./backups/` 备份目录。

## 项目结构

```text
src/
├── app/                        # Next.js App Router
│   ├── admin/                  # 管理后台页面
│   ├── api/                    # API 路由
│   │   ├── admin/             # 管理接口（需认证）
│   │   └── verify/            # 激活码验证接口（公开）
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # 首页
├── lib/                        # 工具库
│   ├── db.ts                  # Prisma Client 单例
│   ├── jwt.ts                 # JWT 签发与验证（从数据库读取密钥和过期时间）
│   ├── auth-middleware.ts     # API 路由认证中间件
│   └── config-service.ts      # 数据库配置服务（动态配置缓存 + 默认值回退）
├── config.ts                   # 系统主配置（硬编码默认值，生产部署前修改 JWT 密钥）
└── middleware.ts               # Next.js 中间件（仅检查 cookie 存在性，不验证签名）

prisma/
├── schema.prisma               # 数据库模型定义
└── dev.db                      # SQLite 数据库文件

scripts/                        # 初始化与运维脚本
├── init-default-admin.ts
├── init-system-config.ts
├── backup-db.sh
├── restore-db.sh
└── docker-manage.sh           # Docker 一键管理脚本（build/rebuild/backup/logs 等）
```

## 架构要点

### 配置管理：硬编码 + 数据库动态配置双轨制

- **不使用 `.env` 文件**，所有配置集中在 `src/config.ts` 中管理。
- **`src/config.ts` 中的值是开发默认值**，生产部署前务必修改 `jwt.secret`。
- **动态配置通过 `SystemConfig` 表管理**，由 `config-service.ts` 提供缓存读取：
  - 内存缓存 5 分钟（`CACHE_DURATION = 5 * 60 * 1000`）
  - 缓存未命中或过期时从数据库读取
  - 数据库无值时回退到 `defaultValues`（与 `src/config.ts` 中的硬编码值一致）
  - `getConfigWithDefault(key)` 是获取配置的主要入口

### 认证与权限：中间件 + API 两层分工

| 层级 | 文件 | 职责 |
| --- | --- | --- |
| **中间件** | `src/middleware.ts` | 匹配 `/admin/*`，仅检查 IP 白名单（仅生产环境生效）和 `auth-token` cookie 是否存在。**不验证 JWT 签名**。 |
| **API 层** | `src/lib/auth-middleware.ts` | `verifyAuth()` 执行真正的 JWT 签名验证，同时从数据库读取动态 IP 白名单。所有 `/api/admin/*` 路由入口处调用。 |

- 中间件中的 IP 白名单检查仅在 `NODE_ENV=production` 时生效，开发环境自动放行。
- 登录成功后，JWT 通过 `httpOnly` cookie (`auth-token`) 传递。
- `allowedIPs` 支持 `0.0.0.0` 作为通配符允许所有 IP。

### 数据库模型

| 模型 | 作用 |
| --- | --- |
| `ActivationCode` | 激活码主表，含 code / isUsed / usedBy / validDays / cardType |
| `Admin` | 管理员账号，密码 bcrypt 哈希存储 |
| `SystemConfig` | 动态系统配置（key-value 形式） |

### 激活码过期逻辑（核心设计）

- **过期时间从激活时开始计算**，不是创建时间。
- 未激活的激活码不会过期（`expiresAt` 为 null，激活时按 `validDays` 计算）。
- `validDays` 存储有效天数，`cardType` 存储套餐类型（周卡/月卡/季卡/年卡）。
- 过期激活码的绑定关系可通过 `POST /api/admin/codes/cleanup` 批量清理，清理后原机器可重新绑定新激活码。
- 一机器一码限制：验证接口会检查 `usedBy` 字段，同一 `machine_id` 在已有激活码未过期时不能使用新码。

### API 路由设计

- 管理后台 API 统一前缀 `/api/admin/*`，需通过 `verifyAuth` 中间件验证。
- 激活码验证接口为 `/api/verify`，无需认证，接受 `code` 和 `machine_id`。
- 响应格式：管理接口通常返回 `{ success: boolean, message?: string, data?: any }`；验证接口返回 `{ success: boolean, message: string, expires_at?: string }`。

### 激活码生成

- 使用 `crypto.randomBytes(8).toString('hex').toUpperCase()` 生成 16 位大写十六进制字符串。
- 通过 `do...while` 循环查询数据库确保唯一性。

## 开发注意事项

- **SQLite 数据库文件**：`prisma/dev.db` 是实际数据文件，提交到 git 会包含测试数据，生产部署时注意替换。
- **Docker 数据持久化**：`docker-compose.yml` 将数据库文件挂载到 `./data/prisma/`（宿主机），而非 `./prisma/`。如需查看或备份 Docker 运行中的数据库，直接操作 `./data/prisma/dev.db`。
- **Prisma Client 单例**：`src/lib/db.ts` 中通过全局变量防止开发环境热重载时重复创建 Prisma Client 实例。
- **Server Components 外部包**：`next.config.js` 中配置了 `serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs']`，避免 Edge Runtime 兼容问题。

## 首次部署流程

```bash
npm install
npm run db:generate
npm run db:push
npm run init-default-admin
npm run init-system-config
npm run dev
```

## Docker 独立部署

```bash
docker compose up -d
```

- 服务启动后访问管理后台：`http://localhost:3001/admin/login`
- `docker-compose.yml` 已配置自动初始化命令（`prisma db push` + `init-system-config` + `init-default-admin`），首次启动通常无需手动执行。
- SQLite 数据库通过 Bind Mount `./data/prisma:/app/prisma` 持久化到宿主机，容器重建不丢失数据。`./data/` 目录已加入 `.gitignore`。

## 与口腔 SaaS 系统的对接

- SaaS 后端通过 HTTP API 调用本服务的 `/api/verify` 接口验证诊所激活码。
- 每个诊所绑定一个激活码，激活码过期则该诊所所有用户无法登录。
- SaaS 后端 `LicenseVerificationService` 负责调用验证逻辑，支持网络异常时的本地过期时间容错。

### 验证接口

- **POST** `/api/verify`
- 请求体：`{ "code": "激活码", "machine_id": "saas-clinic-{诊所ID}" }`
- `machine_id` 格式：口腔 SaaS 系统使用 `saas-clinic-{clinic.id}` 作为机器唯一标识，每个诊所对应一个激活码。
- 成功响应：`{ "success": true, "message": "激活码验证成功", "expires_at": "2024-12-31T00:00:00.000Z" }`
- 失败响应：`{ "success": false, "message": "错误信息" }`
