# 摄影作品展示网站

一个极简风格的摄影作品展示网站，采用复古淡黄色主题，具有独特的首页随机照片切换和复古相纸灯箱效果。

## 功能特性

- **首页随机展示**：自动随机切换照片，800ms 快速切换，带来抽奖般的随机感
- **点击暂停**：点击空白区域可暂停/恢复照片切换
- **复古相纸灯箱**：点击照片弹出复古拍立得风格的大图预览
- **瀑布流作品集**：使用 Masonry 布局展示所有作品
- **响应式设计**：完美适配桌面端、平板和手机
- **键盘导航**：灯箱支持键盘左右切换和 ESC 关闭

## 技术栈

- **构建工具**：Vite
- **前端框架**：React 18
- **路由**：React Router
- **瀑布流**：react-masonry-css
- **样式**：CSS Modules

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

浏览器访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

### 预览生产版本

```bash
npm run preview
```

## 项目结构

```
show/
├── public/
│   └── images/          # 照片资源
├── src/
│   ├── components/
│   │   ├── HomePage.jsx           # 首页：随机照片切换
│   │   ├── HomePage.module.css
│   │   ├── Portfolio.jsx          # 作品集页面
│   │   ├── Portfolio.module.css
│   │   ├── MasonryGrid.jsx        # 瀑布流组件
│   │   ├── MasonryGrid.module.css
│   │   ├── RetroLightbox.jsx      # 复古相纸灯箱
│   │   ├── RetroLightbox.module.css
│   │   ├── Navbar.jsx             # 导航栏
│   │   └── Navbar.module.css
│   ├── data/
│   │   └── photos.js              # 照片数据
│   ├── App.jsx                    # 主应用
│   ├── main.jsx                   # 入口文件
│   └── index.css                  # 全局样式
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── .prettierrc
└── eslint.config.js
```

## 添加照片

编辑 `src/data/photos.js` 文件，按照以下格式添加照片：

```javascript
{
  id: 7,
  src: '/images/your-photo.jpg',  // 或使用在线图片 URL
  title: '照片标题',
  date: '2024-09-01',
  category: 'landscape',  // landscape | portrait | street
  rotation: -2  // 灯箱中的旋转角度（-3 到 3）
}
```

## 自定义主题

编辑 `src/index.css` 中的 CSS 变量来自定义颜色主题：

```css
:root {
  --bg-primary: #f5f0e8;      /* 主背景色 */
  --bg-secondary: #ebe5d9;    /* 次要背景色 */
  --text-primary: #4a4a4a;    /* 主文字颜色 */
  --text-secondary: #8b7355;  /* 次要文字颜色 */
  --accent: #8b7355;          /* 强调色 */
}
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产版本 |
| `npm run lint` | 运行代码检查 |
| `npm run format` | 格式化代码 |

## 许可证

MIT
