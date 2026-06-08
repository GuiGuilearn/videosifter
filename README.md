
# 🎬 VideoSifter — 视频素材管理器

> 一款专为视频创作者打造的本地素材浏览、筛选与管理桌面工具。  
> 基于 Electron + Vue 3 + Vite 构建，纯本地运行，无需联网。

---

## 截图

| 浏览视图 | 星级/标签筛选 | QuickLook 原画预览 |
|---|---|---|
| ![grid](https://via.placeholder.com/300x180?text=Grid+View) | ![filter](https://via.placeholder.com/300x180?text=Filter) | ![ql](https://via.placeholder.com/300x180?text=QuickLook) |

> 截图中 placeholder，可用真实截图替换。

---

## 功能一览

| 功能 | 说明 |
|---|---|
| **文件夹扫描** | 选择素材文件夹，自动提取视频元数据和缩略图 |
| **星级评分** | ★1~5 评分，支持即时清除，按星级筛选 |
| **标签分类** | 自定义标签，颜色标记，一键切换，多标签管理 |
| **缩略图预览** | 鼠标悬停滑擦浏览帧序列（帧模式） |
| **视频预览** | 代理视频生成后，悬停即可实时浏览视频内容 |
| **快速预览** | 空格键一键原画弹窗预览，支持播放控制 |
| **代理生成** | 手动触发生成低分辨率代理视频，可随时暂停/恢复 |
| **导出筛选** | 按星级/标签组织导出，支持复制或移动 |
| **网格缩放** | Ctrl + 滚轮实时调整卡片大小（120px~360px） |
| **文件夹监听** | 自动检测文件夹变化并同步更新 |
| **深色+浅色设计** | 浅色 indigo 主题，视觉清爽 |

---

## 快速上手

### 0. 前置依赖

安装 [FFmpeg](https://ffmpeg.org/download.html) 并确保它在系统 PATH 中：

```bash
ffmpeg -version
# 如果显示版本号，说明已安装
```

> VideoSifter 依赖 FFmpeg 提取视频元数据、生成缩略图、转码代理视频。

### 1. 下载与运行

```bash
# 克隆项目
git clone git@github.com:GuiGuilearn/videosifter.git
cd videosifter

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

### 2. 基本使用流程

```
① 启动 → ② 点击右上角「+ 添加文件夹」→ ③ 选择素材目录
                                    ↓
                              自动扫描，生成缩略图
                                    ↓
④ 浏览视频 → 评分/贴标签 → ⑤ 如需视频预览 → 点击「▶ 代理」
                                    ↓
                              生成完成后 → 切换到「视频」模式
                                    ↓
⑥ 筛选完成后 → 点击「📤 导出」→ 选择路径 → 开始导出
```

### 3. 快捷键

| 快捷键 | 功能 |
|---|---|
| `Space` | 打开/关闭原画预览弹窗 |
| `Escape` | 关闭预览弹窗 |
| `Ctrl + 滚轮` | 缩放网格卡片尺寸 |
| 鼠标悬停 | 滑动预览帧/视频内容 |

---

## 架构概览

```
video-sifter/
├── electron/                # Electron 主进程
│   ├── main.ts             # 主进程入口，窗口管理
│   ├── preload.ts          # 预加载脚本，暴露安全 API
│   ├── ipc-handlers.ts     # IPC 通信处理器（核心逻辑）
│   ├── database.ts         # SQLite 数据库操作层
│   ├── ffmpeg.ts           # FFmpeg 封装（元数据/缩略图/代理）
│   └── file-system.ts      # 文件系统工具（扫描/缓存/路径）
│
├── src/                    # Vue 3 渲染进程
│   ├── App.vue            # 主应用组件（完整界面）
│   ├── components/         # 子组件（Sidebar/TagManager/ExportDialog 等）
│   ├── stores/             # Pinia 状态管理
│   ├── types/              # TypeScript 类型定义 + IPC 通道常量
│   ├── utils/              # 工具函数（格式化等）
│   └── main.ts             # Vue 应用入口
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

### 数据流

```
用户操作 → Vue 组件 → window.electronAPI.xxx()
                              ↓
                      preload.ts (IPC invoke)
                              ↓
                   ipc-handlers.ts (主进程)
                  ┌──────┬──────┬──────┐
                  │ DB    │ 磁盘  │ FFmpeg│
                  └──────┴──────┴──────┘
                              ↓
                   IPC 响应 → Vue 更新视图
```

---

## 核心设计详解

### 代理视频（Proxy）

扫描时**默认不生成代理视频**，只生成缩略图。代理为手动触发：

```
点击「▶ 代理」→ 逐视频生成低分辨率代理（.mp4）
                        ↓
          进度条实时显示百分比，可再次点击暂停
                        ↓
          完成后 → 有代理的卡片显示白边边框
                        ↓
          切换到「视频」模式 → 悬停即可实时预览
```

- 代理存储在 `%APPDATA%\video-sifter\thumbnails\proxies\`
- 无代理的视频降级为缩略图帧预览
- 点击「🔄 刷新」不会重新生成代理（代理只增不减）

### 缓存策略

| 缓存类型 | 位置 | 清理策略 |
|---|---|---|
| 缩略图 | `%APPDATA%.../thumbnails/thumbnails/` | 扫描末尾自动清理孤儿文件 |
| 代理视频 | `%APPDATA%.../thumbnails/proxies/` | 代理生成/扫描末尾自动清理 |
| 数据库 | `%APPDATA%.../video-sifter.db` | 手动删除即可重置全部状态 |

### 预览模式

| 模式 | 说明 | 触发条件 |
|---|---|---|
| **帧模式**（默认） | 悬停显示按鼠标位置对应的关键帧截图 | 无代理视频/缩略图模式 |
| **视频模式** | 悬停播放代理视频音画内容 | 需代理视频已生成 |

---

## 开发指南

```bash
# 开发模式（热更新）
npm run dev

# 构建生产版本
npm run build

# 预览构建产物
npm run preview

# 类型检查
npx vue-tsc --noEmit
```

### 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 35 |
| 前端框架 | Vue 3 (Composition API + `<script setup>`) |
| 构建工具 | Vite 8 |
| 数据库 | better-sqlite3 (SQLite) |
| 视频处理 | FFmpeg (child_process) |
| 类型系统 | TypeScript |
| IPC 通信 | Electron ipcMain / ipcRenderer + contextBridge |

---

## 常见问题

### Q: 扫描慢怎么办？
初次扫描大量视频会慢一些（生成缩略图依赖 FFmpeg）。后续刷新**只增量处理新增/变更的文件**，瞬间完成。

### Q: 代理生成到一半想停？
再次点击「▶ 代理」按钮（变为红色 "50%" 时点击即可暂停），下次点击续传。

### Q: 如何完全重置？
```bash
# 关闭应用后执行：
rm -rf "$APPDATA/video-sifter/video-sifter.db"
rm -rf "$APPDATA/video-sifter/thumbnails"
# 重新打开应用即可
```

### Q: 支持哪些视频格式？
通过 FFmpeg 解析，支持常见格式：MP4, MOV, AVI, MKV, WEBM, WMV, FLV 等。

### Q: 回收站的文件去哪了？
删除视频会移入系统回收站（**不是永久删除**），可在系统回收站中还原。

---

## License

MIT
