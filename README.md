# Life Gallery

个人兴趣爱好展示平台，当前包含摄影模块，后续将扩展更多兴趣模块。

## 摄影模块

- 首页随机切换照片，图片预加载确保无闪烁
- 复古相纸灯箱预览
- 瀑布流作品集 + 无限滚动
- 管理后台：照片上传、编辑、删除

## 用户系统

- JWT 认证（access token + refresh token）
- 三角色权限：admin、editor、viewer

## 快速开始

```bash
npm install
npm run dev
```

- 前端：http://localhost:5174
- 后端：http://localhost:3001
- 默认账户：`admin` / `admin123`

## Tech

React + Vite + Ant Design + Express + SQLite

## License

MIT
