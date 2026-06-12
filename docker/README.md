# Easytoac Docker 使用指南

本文档面向使用 Docker 部署和维护 Easytoac 激活码管理系统的用户。

---

## 目录

1. [环境要求](#环境要求)
2. [快速启动](#快速启动)
3. [开发流程](#开发流程)
4. [脚本命令说明](#脚本命令说明)
5. [生成交付包](#生成交付包)
6. [交付包部署](#交付包部署)
7. [日常维护](#日常维护)
8. [数据备份与恢复](#数据备份与恢复)
9. [常见问题](#常见问题)

---

## 环境要求

- Docker Engine >= 20.10
- Docker Compose >= 2.0
- 操作系统：Linux / macOS / Windows（WSL2）

---

## 快速启动

首次部署时，在项目根目录执行：

```bash
./scripts/docker-manage.sh build
```

启动完成后访问：

- 管理后台：`http://localhost:3001/admin/login`
- 默认账号：`admin / 123456`

首次启动会自动完成：

1. 创建 SQLite 数据库
2. 初始化系统配置
3. 创建默认管理员账号

---

## 开发流程

### 修改代码后重新构建

```bash
./scripts/docker-manage.sh rebuild
```

该命令会：

1. 停止当前运行的容器
2. 自动备份 `./data/prisma/dev.db` 到 `./backups/`
3. 重新构建镜像（使用最新代码）
4. 启动新容器
5. 执行健康检查

> 数据通过 Bind Mount 文件级挂载持久化到 `./data/prisma/dev.db`，重建镜像不会丢失。
>
> 注意：只挂载数据库文件，不挂载整个 `./data/prisma/` 目录，避免覆盖镜像中的 `schema.prisma`。

### 本地开发（不使用 Docker）

```bash
npm install
npm run db:generate
npm run db:push
npm run init-default-admin
npm run init-system-config
npm run dev
```

开发服务器运行在 `http://localhost:3000`。

---

## 脚本命令说明

所有命令都在项目根目录执行：

| 命令 | 作用 |
|------|------|
| `build` | 首次构建镜像并启动容器 |
| `rebuild` | 修改代码后完整重建（含自动备份） |
| `restart` | 仅重启容器，不重建镜像 |
| `stop` | 停止容器 |
| `logs` | 查看容器实时日志 |
| `shell` | 进入容器内部 |
| `backup` | 手动备份数据库到 `./backups/` |
| `export` | 导出镜像为 tar 包到 `./deploy/images/` |
| `load` | 从 tar 包导入镜像 |
| `package` | 生成交付包到 `./deploy/` |
| `clean` | 清理无用镜像和卷 |
| `status` | 查看容器状态和最近备份 |

示例：

```bash
# 查看状态
./scripts/docker-manage.sh status

# 查看日志
./scripts/docker-manage.sh logs

# 手动备份
./scripts/docker-manage.sh backup
```

---

## 生成交付包

修改代码并测试完成后，生成可交给用户的部署包：

```bash
./scripts/docker-manage.sh package
```

该命令会：

1. 强制不使用缓存构建最新镜像
2. 导出镜像到 `images/easytoac-latest.tar`
3. 生成适合交付的 `docker-compose.yml`（使用预构建镜像，无需重新构建）
4. 复制 `Dockerfile`、`scripts/`、`prisma/`、数据目录等
5. 生成用户一键启动脚本 `start.sh`
6. 打包为 `./deploy/easytoac-deploy-YYYYMMDD_HHMMSS.tar.gz`

---

## 交付包部署

将生成的 tar.gz 文件交给用户，用户在目标服务器上执行：

```bash
tar -xzf easytoac-deploy-YYYYMMDD_HHMMSS.tar.gz
cd easytoac-deploy-YYYYMMDD_HHMMSS
./start.sh
```

`start.sh` 会自动完成：

1. 加载 Docker 镜像
2. 初始化数据目录
3. 启动服务

启动后访问 `http://localhost:3001/admin/login`。

---

## 日常维护

### 查看运行状态

```bash
./scripts/docker-manage.sh status
```

### 查看日志

```bash
./scripts/docker-manage.sh logs
```

按 `Ctrl+C` 退出日志查看。

### 进入容器

```bash
./scripts/docker-manage.sh shell
```

### 重启服务

```bash
./scripts/docker-manage.sh restart
```

### 停止服务

```bash
./scripts/docker-manage.sh stop
```

---

## 数据备份与恢复

### 自动备份

`rebuild` 命令在重建前会自动备份数据库到：

```text
./backups/dev.db.backup_YYYYMMDD_HHMMSS
```

### 手动备份

```bash
./scripts/docker-manage.sh backup
```

### 恢复数据

停止容器后，将备份文件复制到数据目录：

```bash
./scripts/docker-manage.sh stop
cp ./backups/dev.db.backup_YYYYMMDD_HHMMSS ./data/prisma/dev.db
./scripts/docker-manage.sh build
```

---

## 常见问题

### 1. 端口被占用

如果 `3001` 端口被占用，修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "3002:3000"
```

### 2. 镜像构建失败

尝试清理构建缓存后重新构建：

```bash
./scripts/docker-manage.sh clean
./scripts/docker-manage.sh rebuild
```

### 3. 数据目录权限问题

确保当前用户对 `./data/prisma/dev.db` 文件有读写权限：

```bash
mkdir -p ./data/prisma
touch ./data/prisma/dev.db
chmod 644 ./data/prisma/dev.db
```

如果 `./data/prisma/dev.db` 被 Docker 错误创建为目录，请先删除该目录，再创建空文件：

```bash
rm -rf ./data/prisma/dev.db
touch ./data/prisma/dev.db
```

### 4. 容器启动后无法访问

查看日志排查问题：

```bash
./scripts/docker-manage.sh logs
```

常见原因：

- 数据库初始化失败
- 端口冲突
- 权限不足
- 文件级挂载未正确初始化（确保 `./data/prisma/dev.db` 是文件，不是目录）

### 5. 报错 "Could not find Prisma Schema"

这是因为 `docker-compose.yml` 错误地挂载了整个 `./data/prisma/` 目录，覆盖了镜像中的 `schema.prisma` 文件。

当前版本已修复为文件级挂载 `./data/prisma/dev.db:/app/prisma/dev.db`。如果你遇到此问题，请检查：

```bash
# 1. 停止容器
./scripts/docker-manage.sh stop

# 2. 确认 dev.db 是文件而不是目录
ls -la ./data/prisma/

# 3. 如果是目录，删除后重新创建空文件
rm -rf ./data/prisma/dev.db
touch ./data/prisma/dev.db

# 4. 重新启动
./scripts/docker-manage.sh build
```

### 6. NAS 上提示 "exec format error" 或平台不匹配

这个错误表示镜像架构和 NAS 的 CPU 架构不一致。例如：在 Apple Silicon Mac（ARM64）上构建的镜像，放到 x86_64（AMD64）的 NAS 上运行就会报这个错。

#### 查看镜像架构

```bash
docker image inspect easytoac-license-server:latest --format '{{.Os}}/{{.Architecture}}'
```

#### 解决方案

##### 方案 A：在 NAS 上直接构建（最推荐）

把项目源码复制到 NAS 上，在 NAS 上执行：

```bash
./scripts/docker-manage.sh build
```

这样构建出来的镜像一定和 NAS 架构匹配。

##### 方案 B：在 Mac 上交叉编译为 AMD64

默认已启用 `linux/amd64` 平台，如果你的 NAS 是 x86_64，直接执行：

```bash
npm run docker:package
```

生成的交付包就是 AMD64 版本，可直接放到 NAS 上运行。

##### 方案 C：构建为 ARM64

如果你的 NAS 是 ARM64（如部分树莓派、ARM NAS），手动指定平台：

```bash
export PLATFORM=linux/arm64
npm run docker:package
```

#### 修改运行端口

如果 NAS 的 `3001` 端口被占用，修改 `docker-compose.yml`：

```yaml
ports:
  - "3002:3000"
```

然后重新启动：

```bash
docker compose down
./start.sh
```
