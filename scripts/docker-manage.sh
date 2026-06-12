#!/bin/bash
# =============================================================================
# Easytoac Docker 管理脚本
# =============================================================================
# 功能: 一键管理 Docker 容器的构建、重建、备份、日志等操作
# 用法: ./scripts/docker-manage.sh [命令]
#
# 提示:
#   - 如果直接执行提示 "Permission denied"，请先运行:
#       chmod +x scripts/docker-manage.sh
#   - 也可以不依赖执行权限，通过 bash 运行:
#       bash scripts/docker-manage.sh [命令]
#   - 或者通过 npm 脚本运行:
#       npm run docker:manage [命令]
#   - 默认构建 linux/amd64 镜像，如需 ARM64 请设置:
#       export PLATFORM=linux/arm64
#
# 可用命令:
#   build    - 首次构建镜像并启动容器
#   rebuild  - 停止容器 → 备份数据 → 重建镜像 → 启动容器 → 健康检查
#   restart  - 仅重启容器（不重建镜像）
#   stop     - 停止容器
#   logs     - 查看容器实时日志
#   shell    - 进入容器内部
#   backup   - 手动备份 SQLite 数据库到 ./backups/
#   export   - 导出镜像为 tar 包到 ./deploy/images/（方便迁移部署）
#   load     - 从 ./deploy/images/easytoac-latest.tar 导入镜像
#   package  - 生成交付包（构建无缓存镜像 + 打包部署文件到 ./deploy/）
#   clean    - 清理无用的 Docker 镜像和卷
#   status   - 查看容器运行状态
#   help     - 显示帮助信息
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="easytoac"
CONTAINER_NAME="easytoac-license-server"
DATA_DIR="./data/prisma"
BACKUP_DIR="./backups"
EXPORT_DIR="./deploy/images"
COMPOSE_FILE="docker-compose.yml"
IMAGE_NAME="easytoac-license-server"

# Docker 目标平台，默认 linux/amd64（兼容大部分 NAS 和云服务器）
# 如需构建其他架构，可设置环境变量覆盖，例如:
#   export PLATFORM=linux/arm64
#   ./scripts/docker-manage.sh package
export PLATFORM=${PLATFORM:-linux/amd64}

# 辅助函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}▶${NC} ${BOLD}$1${NC}"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    if ! command -v docker compose &> /dev/null && ! docker-compose --version &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
}

# 获取 docker compose 命令
docker_compose_cmd() {
    if command -v docker compose &> /dev/null; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# 检查容器是否运行
is_container_running() {
    docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

# 备份数据库
backup_data() {
    log_step "备份数据库..."
    if [ -f "${DATA_DIR}/dev.db" ]; then
        mkdir -p "${BACKUP_DIR}"
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_file="${BACKUP_DIR}/dev.db.backup_${timestamp}"
        cp "${DATA_DIR}/dev.db" "${backup_file}"
        log_success "数据库已备份到: ${backup_file}"
    else
        log_warn "数据库文件不存在，跳过备份"
    fi
}

# 确保数据库文件存在（文件级挂载需要）
ensure_data_file() {
    log_info "初始化数据文件..."
    mkdir -p "${DATA_DIR}"
    if [ ! -f "${DATA_DIR}/dev.db" ]; then
        touch "${DATA_DIR}/dev.db"
        log_info "已创建空数据库文件: ${DATA_DIR}/dev.db"
    fi
}

# 构建并启动
cmd_build() {
    log_step "开始构建 Docker 镜像并启动服务..."
    check_docker

    local compose_cmd=$(docker_compose_cmd)

    log_info "构建镜像..."
    ${compose_cmd} -f ${COMPOSE_FILE} build --no-cache

    ensure_data_file

    log_info "启动容器..."
    ${compose_cmd} -f ${COMPOSE_FILE} up -d

    log_info "等待服务启动..."
    sleep 5

    if is_container_running; then
        log_success "服务启动成功！"
        log_info "访问地址: http://localhost:3001"
        log_info "管理后台: http://localhost:3001/admin/login"
        log_info "默认账号: admin / 123456"
    else
        log_error "服务启动失败，请查看日志: ./scripts/docker-manage.sh logs"
        exit 1
    fi
}

# 重建（含备份）
cmd_rebuild() {
    log_step "开始重建服务..."
    check_docker

    local compose_cmd=$(docker_compose_cmd)

    # 1. 停止容器
    log_info "停止现有容器..."
    ${compose_cmd} -f ${COMPOSE_FILE} stop || true

    # 2. 备份数据
    backup_data

    # 3. 重建镜像
    log_info "重新构建镜像..."
    ${compose_cmd} -f ${COMPOSE_FILE} build --no-cache

    # 4. 确保数据文件存在（文件级挂载需要）
    ensure_data_file

    # 5. 启动容器
    log_info "启动容器..."
    ${compose_cmd} -f ${COMPOSE_FILE} up -d

    # 6. 健康检查
    log_info "等待健康检查..."
    local retries=0
    local max_retries=30
    while [ $retries -lt $max_retries ]; do
        if is_container_running; then
            # 尝试访问健康检查接口
            if docker exec ${CONTAINER_NAME} wget --quiet --tries=1 --spider http://localhost:3000/ 2>/dev/null; then
                log_success "健康检查通过！"
                break
            fi
        fi
        retries=$((retries + 1))
        echo -n "."
        sleep 2
    done

    if [ $retries -eq $max_retries ]; then
        log_warn "健康检查超时，但容器已启动"
    fi

    echo ""
    log_success "重建完成！"
    log_info "访问地址: http://localhost:3001"
    log_info "管理后台: http://localhost:3001/admin/login"
}

# 仅重启容器
cmd_restart() {
    log_step "重启容器..."
    check_docker
    local compose_cmd=$(docker_compose_cmd)
    ${compose_cmd} -f ${COMPOSE_FILE} restart
    log_success "容器已重启"
}

# 停止容器
cmd_stop() {
    log_step "停止容器..."
    check_docker
    local compose_cmd=$(docker_compose_cmd)
    ${compose_cmd} -f ${COMPOSE_FILE} stop
    log_success "容器已停止"
}

# 查看日志
cmd_logs() {
    check_docker
    local compose_cmd=$(docker_compose_cmd)
    log_info "按 Ctrl+C 退出日志查看"
    ${compose_cmd} -f ${COMPOSE_FILE} logs -f
}

# 进入容器
cmd_shell() {
    log_step "进入容器..."
    check_docker
    if ! is_container_running; then
        log_error "容器未运行，请先启动"
        exit 1
    fi
    docker exec -it ${CONTAINER_NAME} sh
}

# 手动备份
cmd_backup() {
    log_step "手动备份数据库..."
    if [ ! -f "${DATA_DIR}/dev.db" ]; then
        log_error "数据库文件不存在: ${DATA_DIR}/dev.db"
        exit 1
    fi
    backup_data
}

# 导出镜像为 tar 包（方便迁移到其他服务器）
cmd_export() {
    log_step "导出 Docker 镜像..."
    check_docker

    local compose_cmd=$(docker_compose_cmd)
    local image_tag=$(date +%Y%m%d_%H%M%S)
    local image_file="${EXPORT_DIR}/easytoac-${image_tag}.tar"
    local latest_file="${EXPORT_DIR}/easytoac-latest.tar"

    # 确保镜像已构建
    log_info "检查镜像是否存在..."
    if ! docker image inspect ${IMAGE_NAME}:latest &>/dev/null; then
        log_info "镜像不存在，先构建镜像..."
        ${compose_cmd} -f ${COMPOSE_FILE} build --no-cache
    fi

    mkdir -p "${EXPORT_DIR}"

    log_info "导出镜像到: ${image_file}"
    docker save -o "${image_file}" ${IMAGE_NAME}:latest

    # 同时创建/更新 latest 软链接或副本
    cp -f "${image_file}" "${latest_file}"

    log_success "镜像导出完成"
    log_info "导出文件: ${image_file}"
    log_info "最新文件: ${latest_file}"
    log_info "文件大小: $(du -h ${image_file} | cut -f1)"
    echo ""
    log_info "迁移到其他服务器时，先复制 tar 文件，然后执行:"
    log_info "  docker load -i ${latest_file}"
    log_info "  docker compose up -d"
}

# 从 tar 包导入镜像
cmd_load() {
    log_step "导入 Docker 镜像..."
    check_docker

    local latest_file="${EXPORT_DIR}/easytoac-latest.tar"

    if [ ! -f "${latest_file}" ]; then
        log_error "镜像文件不存在: ${latest_file}"
        log_info "请先在开发环境执行: ./scripts/docker-manage.sh export"
        exit 1
    fi

    log_info "从文件导入镜像: ${latest_file}"
    docker load -i "${latest_file}"
    log_success "镜像导入完成"
    echo ""
    log_info "可以使用以下命令启动服务:"
    log_info "  docker compose up -d"
}

# 生成交付包（包含最新镜像 + 部署文件，可直接交给用户）
cmd_package() {
    log_step "开始生成交付包..."
    check_docker

    local compose_cmd=$(docker_compose_cmd)
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local package_name="easytoac-deploy-${timestamp}"
    local package_dir="${EXPORT_DIR}/${package_name}"
    local package_tar="./deploy/${package_name}.tar.gz"

    # 1. 构建最新镜像（强制不使用缓存，确保使用最新代码）
    log_info "构建最新镜像（不使用缓存）..."
    ${compose_cmd} -f ${COMPOSE_FILE} build --no-cache

    # 2. 准备交付包目录
    log_info "准备交付包目录..."
    rm -rf "${package_dir}"
    mkdir -p "${package_dir}/images"

    # 3. 导出镜像
    log_info "导出镜像..."
    docker save -o "${package_dir}/images/easytoac-latest.tar" ${IMAGE_NAME}:latest

    # 4. 复制部署所需文件
    log_info "复制部署文件..."
    cp Dockerfile "${package_dir}/" 2>/dev/null || true
    cp -r scripts "${package_dir}/" 2>/dev/null || true
    cp -r prisma "${package_dir}/" 2>/dev/null || true
    mkdir -p "${package_dir}/data/prisma"
    cp -r data/prisma "${package_dir}/data/" 2>/dev/null || true
    cp CLAUDE.md "${package_dir}/" 2>/dev/null || true
    cp README.md "${package_dir}/" 2>/dev/null || true

    # 生成适合交付的 docker-compose.yml（使用预构建镜像，去掉 build 配置，
    # 避免 Container Manager 等工具尝试重新拉取基础镜像导致失败）
    log_info "生成交付版 docker-compose.yml..."
    cat > "${package_dir}/${COMPOSE_FILE}" << EOF
# =============================================================================
# Easytoac 激活码管理系统 - Docker Compose 部署配置
# =============================================================================
# 说明:
#   本文件随交付包一起交给用户，使用预构建的 Docker 镜像，无需重新构建。
#   如需重新构建镜像，请使用项目源码中的 docker-compose.yml 和 Dockerfile。
#
# 首次启动:
#   docker compose up -d
# =============================================================================

services:
  easytoac:
    # 预构建镜像名称，由 start.sh 加载
    image: ${IMAGE_NAME}:latest

    # 目标平台，与交付包镜像架构一致
    platform: ${PLATFORM}

    # 容器名称
    container_name: ${CONTAINER_NAME}

    # 重启策略
    restart: unless-stopped

    # 端口映射
    ports:
      - "3001:3000"

    # 环境变量
    environment:
      - NODE_ENV=production
      - PORT=3000

    # 启动命令
    command: >
      sh -c "npx prisma db push --accept-data-loss --skip-generate &&
             npx tsx scripts/init-system-config.ts &&
             npx tsx scripts/init-default-admin.ts &&
             exec npm start"

    # 持久化数据库文件（文件级挂载，避免覆盖镜像中的 schema.prisma）
    volumes:
      - ./data/prisma/dev.db:/app/prisma/dev.db

    # 健康检查
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
EOF

    # 5. 生成一键启动脚本
    log_info "生成启动脚本..."
    cat > "${package_dir}/start.sh" << 'EOF'
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

echo "[1/3] 加载 Docker 镜像..."
docker load -i images/easytoac-latest.tar

echo "[2/3] 初始化数据目录..."
mkdir -p ./data/prisma
if [ ! -f "./data/prisma/dev.db" ]; then
    touch "./data/prisma/dev.db"
    echo "已创建空数据库文件: ./data/prisma/dev.db"
fi

echo "[3/3] 启动服务..."
docker compose up -d

echo ""
echo "服务启动完成！"
echo "访问地址: http://localhost:3001"
echo "管理后台: http://localhost:3001/admin/login"
echo "默认账号: admin / 123456"
echo ""
echo "查看日志: docker compose logs -f"
EOF
    chmod +x "${package_dir}/start.sh"

    # 6. 打包为 tar.gz
    log_info "打包交付包..."
    mkdir -p ./deploy
    tar -czf "${package_tar}" -C "${EXPORT_DIR}" "${package_name}"

    # 7. 清理临时目录
    rm -rf "${package_dir}"

    log_success "交付包生成完成！"
    echo ""
    log_info "交付包文件: ${package_tar}"
    log_info "包大小: $(du -h ${package_tar} | cut -f1)"
    echo ""
    log_info "交给用户后，用户只需解压并执行:"
    log_info "  tar -xzf ${package_tar}"
    log_info "  cd ${package_name}"
    log_info "  ./start.sh"
}

# 清理无用资源
cmd_clean() {
    log_step "清理无用 Docker 资源..."
    check_docker

    log_info "清理悬空镜像..."
    docker image prune -f

    log_info "清理未使用的卷..."
    docker volume prune -f

    log_info "清理构建缓存..."
    docker builder prune -f

    log_success "清理完成"
}

# 查看状态
cmd_status() {
    log_step "容器状态"
    check_docker

    if is_container_running; then
        log_success "容器正在运行"
        echo ""
        docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        log_info "访问地址: http://localhost:3001"
        log_info "管理后台: http://localhost:3001/admin/login"
    else
        log_warn "容器未运行"
        echo ""
        docker ps -a --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
    fi

    # 显示最近的备份
    if [ -d "${BACKUP_DIR}" ] && [ "$(ls -A ${BACKUP_DIR})" ]; then
        echo ""
        log_info "最近的数据库备份:"
        ls -lt ${BACKUP_DIR} | head -5
    fi
}

# 帮助信息
cmd_help() {
    cat << 'EOF'
Easytoac Docker 管理脚本

用法:
  ./scripts/docker-manage.sh [命令]
  bash scripts/docker-manage.sh [命令]
  npm run docker:manage [命令]

说明:
  - 直接执行 ./scripts/docker-manage.sh 需要脚本具有可执行权限
  - 如果提示 "Permission denied"，请运行: chmod +x scripts/docker-manage.sh
  - 通过 bash 或 npm 运行则不需要执行权限
  - 默认构建 linux/amd64 镜像，如需 ARM64 请设置: export PLATFORM=linux/arm64

命令:
  build    首次构建镜像并启动容器
  rebuild  完整重建（备份数据 → 重建镜像 → 启动 → 健康检查）
  restart  仅重启容器（不重建镜像）
  stop     停止容器
  logs     查看容器实时日志
  shell    进入容器内部
  backup   手动备份数据库到 ./backups/
  export   导出镜像为 tar 包到 ./deploy/images/（方便迁移部署）
  load     从 ./deploy/images/easytoac-latest.tar 导入镜像
  package  生成交付包（构建无缓存镜像 + 打包部署文件到 ./deploy/）
  clean    清理无用的 Docker 镜像和卷
  status   查看容器运行状态和最近备份
  help     显示此帮助信息

示例:
  # 首次部署
  ./scripts/docker-manage.sh build

  # 修改代码后重新构建
  ./scripts/docker-manage.sh rebuild

  # 生成交付包（交给用户）
  ./scripts/docker-manage.sh package

  # 查看运行状态
  ./scripts/docker-manage.sh status

  # 查看日志
  ./scripts/docker-manage.sh logs
EOF
}

# 主逻辑
case "${1:-help}" in
    build)
        cmd_build
        ;;
    rebuild)
        cmd_rebuild
        ;;
    restart)
        cmd_restart
        ;;
    stop)
        cmd_stop
        ;;
    logs)
        cmd_logs
        ;;
    shell)
        cmd_shell
        ;;
    backup)
        cmd_backup
        ;;
    export)
        cmd_export
        ;;
    load)
        cmd_load
        ;;
    package)
        cmd_package
        ;;
    clean)
        cmd_clean
        ;;
    status)
        cmd_status
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        log_error "未知命令: $1"
        echo ""
        cmd_help
        exit 1
        ;;
esac
