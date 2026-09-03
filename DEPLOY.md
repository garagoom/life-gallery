# Life Gallery 部署指南

## 服务器信息

- **IP:** 47.116.197.41
- **用户:** root
- **系统:** Alibaba Linux 4
- **Node.js:** v22.23.0
- **PM2:** 6.x
- **项目目录:** /opt/life-gallery

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 5173，代理 API 到 3001）
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 部署流程

### 1. 构建前端

```bash
cd D:\01_mine\玩\life-gallery
npm run build
```

生成 `dist/` 目录。

### 2. 上传文件到服务器

使用 SCP 上传，密钥路径：`~/.ssh/阿里云.pem`

```bash
# 上传前端 dist
scp -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no -r "D:\01_mine\玩\life-gallery\dist\*" root@47.116.197.41:/opt/life-gallery/dist/

# 上传后端文件（按需）
scp -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no "D:\01_mine\玩\life-gallery\server\routes\*.cjs" root@47.116.197.41:/opt/life-gallery/server/routes/
scp -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no "D:\01_mine\玩\life-gallery\server\middleware\*.cjs" root@47.116.197.41:/opt/life-gallery/server/middleware/
scp -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no "D:\01_mine\玩\life-gallery\server\db.cjs" root@47.116.197.41:/opt/life-gallery/server/db.cjs
```

### 3. 重启服务

```bash
ssh -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no root@47.116.197.41 "pm2 restart life-gallery"
```

### 4. 查看状态

```bash
ssh -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no root@47.116.197.41 "pm2 status"
```

### 5. 查看日志

```bash
ssh -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no root@47.116.197.41 "pm2 logs life-gallery --lines 50 --nostream"
```

## 一键部署脚本

本地 PowerShell 执行：

```powershell
cd "D:\01_mine\玩\life-gallery"
npm run build
scp -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no -r "dist\*" root@47.116.197.41:/opt/life-gallery/dist/
ssh -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no root@47.116.197.41 "pm2 restart life-gallery"
```

## 服务器调试

### 登录服务器

```bash
ssh -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no root@47.116.197.41
```

### 查看数据库

```bash
cat > /tmp/check.cjs << 'EOF'
const { initDb, getDb } = require('/opt/life-gallery/server/db.cjs');
initDb().then(() => {
  const db = getDb();
  const r = db.exec('SELECT * FROM menus ORDER BY sort_order');
  if (r[0]) {
    r[0].values.forEach(row => console.log(row));
  }
}).catch(e => console.error(e));
EOF
node /tmp/check.cjs
```

### 测试 API

```bash
# 登录获取 token
TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.data.accessToken')

# 调用接口
curl -s http://localhost:3001/api/menus/my \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## Git 推送

```bash
cd "D:\01_mine\玩\life-gallery"
git add -A
git commit -m "feat: xxx"
git push origin main
```

## 常见问题

### 1. 403 权限不足
- 检查用户角色是否有对应菜单权限
- 后端 API 使用 `requireMenu('menuKey')` 检查权限
- 在菜单管理中给角色分配权限

### 2. 500 服务器错误
```bash
ssh -i "~/.ssh/阿里云.pem" -o StrictHostKeyChecking=no root@47.116.197.41 "pm2 logs life-gallery --lines 20 --nostream"
```

### 3. 前端白屏
- 检查浏览器控制台错误
- 确认 dist 已正确上传
- 确认 PM2 进程正常运行

### 4. 数据库迁移
- `db.cjs` 中的 `ALTER TABLE` 会自动添加新列
- 使用 `try/catch` 包裹，已存在则跳过
- 新增数据通过 `INSERT OR IGNORE` 种子数据

## 环境变量

服务器端不需要 `.env` 文件，配置在代码中：
- 端口：3001
- 数据库：`/opt/life-gallery/server/database.sqlite`
- JWT Secret：硬编码在 `auth.cjs`

## 目录结构

```
/opt/life-gallery/
├── dist/              # 前端构建产物
├── server/
│   ├── index.js       # Express 入口
│   ├── db.cjs         # SQLite 数据库
│   ├── routes/        # API 路由
│   ├── middleware/     # 中间件（auth, permission）
│   ├── uploads/       # 上传的原图
│   └── thumbnails/    # 缩略图
├── database.sqlite    # 数据库文件
└── package.json
```
