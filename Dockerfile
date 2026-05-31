# Easytoac 激活码管理系统 - Docker 构建文件
# 使用 Debian Slim 基础镜像，避免 Alpine (musl) 与 Prisma 引擎的兼容性问题
FROM node:18-slim

WORKDIR /app

# 安装系统依赖（Prisma 需要 OpenSSL 库）
RUN apt-get update && apt-get install -y --no-install-recommends openssl wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 安装 tsx 全局（用于运行初始化脚本）
RUN npm install -g tsx

# 复制依赖文件并安装
COPY package*.json ./
RUN npm install

# 复制 Prisma schema 并生成客户端
COPY prisma ./prisma
RUN npx prisma generate

# 复制项目代码
COPY . .

# 构建 Next.js 应用
RUN npm run build

# 暴露服务端口
EXPOSE 3000

# 启动命令（生产模式）
CMD ["npm", "start"]
