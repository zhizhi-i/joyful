# AI Text-to-Image Backend API - Docker 部署

这是AI文字作画项目的后端API Docker镜像构建和部署说明。

## 🚀 快速开始

### 1. 环境变量配置

复制环境变量示例文件：
```bash
cp env.example .env
```

编辑 `.env` 文件，设置必要的配置：
```bash
# 必须设置的变量
DASHSCOPE_API_KEY=your-dashscope-api-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# 可选配置
MYSQL_PASSWORD=your-secure-password
API_PORT=81  # 如果需要修改端口，记得同时修改前端的BACKEND_API_URL
```

### 2. 构建Docker镜像

```bash
npm run docker:build
# 或者直接使用
docker build -t ai-text-to-image-backend .
```

### 3. 运行容器

```bash
# 开发模式运行（使用默认端口81）
npm run docker:run:dev

# 生产模式运行（使用默认端口81）
npm run docker:run:prod

# 自定义端口运行
docker run -p 8081:8081 \
  -e API_PORT=8081 \
  -e DASHSCOPE_API_KEY=your-api-key \
  -e MYSQL_HOST=your-mysql-host \
  ai-text-to-image-backend

# 注意：如果修改了API端口，前端的BACKEND_API_URL也需要相应修改
```

### 4. 使用 Docker Compose（推荐）

一键启动完整服务（包含数据库）：

```bash
# 使用默认端口启动所有服务
docker-compose up -d

# 使用自定义端口启动
API_PORT=8081 docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止所有服务
docker-compose down
```

## 🔧 环境变量配置

### 必需变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DASHSCOPE_API_KEY` | 阿里云通义万相API密钥 | `sk-xxx...` |

### API配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `API_HOST` | `0.0.0.0` | API监听地址 |
| `API_PORT` | `81` | API端口（修改时需同步修改前端配置） |
| `DEBUG` | `False` | 调试模式 |
| `LOG_LEVEL` | `INFO` | 日志级别 |

### 数据库配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MYSQL_HOST` | `mysql` | MySQL主机地址 |
| `MYSQL_PORT` | `3306` | MySQL端口 |
| `MYSQL_DATABASE` | `joyful` | 数据库名 |
| `MYSQL_USER` | `joyful` | 数据库用户名 |
| `MYSQL_PASSWORD` | `123456` | 数据库密码 |

### JWT配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `JWT_SECRET_KEY` | 自动生成 | JWT签名密钥 |
| `JWT_EXPIRES_DAYS` | `30` | Token过期天数 |

## 🗄️ 数据库

### 默认账号

初始化时会自动创建以下账号：

| 角色 | 邮箱 | 密码 | 权限 |
|------|------|------|------|
| 管理员 | `admin@example.com` | `admin123` | 无限制使用 |
| 测试用户 | `user@example.com` | `user123` | 5次试用 |

### 数据库管理

```bash
# 连接到MySQL容器
docker exec -it ai-mysql mysql -u root -p

# 查看用户表
USE joyful;
SELECT * FROM users;

# 手动创建管理员账号
INSERT INTO users (email, password_hash, role, demo_count) 
VALUES ('your-admin@email.com', SHA2('your-password', 256), 'admin', 999999);
```

## 📋 API接口

### 健康检查
```bash
# 使用默认端口
curl http://localhost:81/api/health

# 使用自定义端口
curl http://localhost:8081/api/health
```

### 用户注册
```bash
# 根据实际端口修改
curl -X POST http://localhost:81/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 用户登录
```bash
# 根据实际端口修改
curl -X POST http://localhost:81/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 生成图片
```bash
# 根据实际端口修改
curl -X POST http://localhost:81/api/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"prompt":"beautiful landscape","ratio":"16:9","count":1}'
```

## 🐳 Docker 脚本

```bash
# 构建镜像
npm run docker:build

# 运行（开发模式）
npm run docker:run:dev

# 运行（生产模式）
npm run docker:run:prod

# 自定义端口运行
docker run -d -p 8081:8081 \
  -e API_PORT=8081 \
  -e DASHSCOPE_API_KEY=your-api-key \
  ai-text-to-image-backend

# 查看日志
npm run docker:logs

# 进入容器
npm run docker:shell

# 停止容器
npm run docker:stop

# 清理容器
npm run docker:clean
```

## 🔍 故障排除

### 端口冲突

如果默认的81端口被占用，您可以：

1. 修改端口映射：
   ```bash
   # 方法1：直接指定新端口
   docker run -p 8081:81 ai-text-to-image-backend

   # 方法2：使用环境变量修改内部端口（推荐）
   docker run -p 8081:8081 -e API_PORT=8081 ai-text-to-image-backend
   ```

2. 使用环境变量：
   ```bash
   # 在 .env 文件中修改
   API_PORT=8081

   # 或者在启动时指定
   API_PORT=8081 docker-compose up -d
   ```

3. 记得同时修改前端配置：
   ```bash
   # 前端容器启动时指定新的后端地址
   docker run -e BACKEND_API_URL=http://localhost:8081/api frontend-image
   ```

### 数据库连接失败

1. 检查MySQL容器是否运行：
   ```bash
   docker ps | grep mysql
   ```

2. 检查网络连接：
   ```bash
   docker network ls
   docker network inspect ai-network
   ```

### API密钥配置

1. 确保设置了 `DASHSCOPE_API_KEY`
2. 检查API密钥是否有效
3. 查看容器日志：
   ```bash
   npm run docker:logs
   ```

## 📝 镜像特性

- ✅ 基于 Python 3.11 Alpine（轻量级）
- ✅ 非root用户运行（安全）
- ✅ 多层缓存优化构建
- ✅ 健康检查支持
- ✅ 完整的环境变量配置
- ✅ 生产级安全配置
- ✅ 灵活的端口配置

**镜像大小**: 约 150-200MB  
**启动时间**: 约 10-15秒  
**内存占用**: 约 100-200MB 