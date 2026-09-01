# Life Gallery

个人兴趣爱好展示平台，当前包含摄影模块，后续将扩展更多兴趣模块。

## 功能特性

### 摄影模块
- **首页随机展示**：自动随机切换照片，500ms 快速切换
- **图片预加载**：Loading 页面预加载所有图片，确保首页无闪烁
- **复古相纸灯箱**：点击照片弹出复古拍立得风格的大图预览
- **瀑布流作品集**：Masonry 布局 + 无限滚动加载
- **管理后台**：照片上传、编辑、删除（需 editor/admin 角色）

### 用户系统
- JWT 认证（access token 15min + refresh token 7d）
- 三角色权限：admin（全权限）、editor（照片管理）、viewer（只读）
- 用户管理面板（仅 admin）

### 导航
- 浮动模块切换器（右下角，hover 展开）
- 支持多模块扩展（摄影、旅行、笔记等）

## 技术栈

### 前端
- React 18 + Vite
- React Router
- Ant Design (antd)
- CSS Modules

### 后端
- Express 5
- SQLite (sql.js)
- JWT 认证
- Sharp 图片处理

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
# 同时启动前端和后端
npm run dev
```

- 前端：http://localhost:5174
- 后端：http://localhost:3001

### 默认账户

- 用户名：`admin`
- 密码：`admin123`

### 构建生产版本

```bash
npm run build
```

### 启动生产服务器

```bash
npm run server
```

## 项目结构

```
life-gallery/
├── server/                    # 后端
│   ├── index.cjs             # Express 入口
│   ├── db.cjs                # 数据库初始化
│   ├── middleware/
│   │   ├── auth.cjs          # JWT 认证中间件
│   │   └── permission.cjs    # 角色权限中间件
│   ├── routes/
│   │   ├── auth.cjs          # 登录/登出/刷新 token
│   │   ├── photos.cjs        # 照片 CRUD API
│   │   └── users.cjs         # 用户管理 API
│   ├── uploads/              # 原图存储（gitignore）
│   └── thumbnails/           # 缩略图（gitignore）
├── src/
│   ├── api/                  # API 客户端
│   │   ├── auth.js
│   │   ├── photos.js
│   │   └── users.js
│   ├── components/           # React 组件
│   │   ├── HomePage.jsx      # 首页随机轮播
│   │   ├── Portfolio.jsx     # 作品集（无限滚动）
│   │   ├── Loading.jsx       # 图片预加载页
│   │   ├── Login.jsx         # 登录页
│   │   ├── Admin.jsx         # 照片管理后台
│   │   ├── UserManage.jsx    # 用户管理
│   │   ├── FloatingMenu.jsx  # 浮动导航菜单
│   │   ├── RetroLightbox.jsx # 复古灯箱
│   │   ├── ProtectedRoute.jsx # 路由守卫
│   │   └── MasonryGrid.jsx   # 瀑布流
│   ├── contexts/
│   │   └── AuthContext.jsx   # 认证状态管理
│   ├── data/
│   │   └── photos.js         # 照片数据/工具函数
│   ├── App.jsx               # 路由配置
│   ├── main.jsx              # 入口
│   └── index.css             # 全局样式/主题变量
├── index.html
├── package.json
└── vite.config.js
```

## API 接口

### 认证
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/login` | 登录 | 公开 |
| POST | `/api/auth/refresh` | 刷新 token | 公开 |
| POST | `/api/auth/logout` | 登出 | 登录 |
| GET | `/api/auth/profile` | 获取用户信息 | 登录 |

### 照片
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/photos` | 照片列表 | 公开 |
| GET | `/api/photos/random` | 随机照片 | 公开 |
| POST | `/api/photos` | 上传照片 | editor+ |
| PUT | `/api/photos/:id` | 更新照片 | editor+ |
| DELETE | `/api/photos/:id` | 删除照片 | editor+ |

### 用户管理
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/users` | 用户列表 | admin |
| POST | `/api/users` | 创建用户 | admin |
| PUT | `/api/users/:id` | 更新用户 | admin |
| DELETE | `/api/users/:id` | 删除用户 | admin |

## 主题自定义

编辑 `src/index.css` 中的 CSS 变量：

```css
:root {
  --bg-primary: #f5f0e8;      /* 主背景色 */
  --bg-secondary: #ebe5d9;    /* 次要背景色 */
  --text-primary: #4a4a4a;    /* 主文字颜色 */
  --text-secondary: #8b7355;  /* 次要文字颜色 */
  --accent: #8b7355;          /* 强调色 */
  --border: #d4cdc1;          /* 边框色 */
}
```

## License

MIT
