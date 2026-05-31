# SportsReg - Sports Tournament Registration & Management System
# SportsReg - 体育活动报名与管理系统

---

## 📖 Project Overview / 项目概述

**SportsReg** is a full-stack, mobile-first web application designed to manage sports tournaments, user registrations, and leaderboards. It provides a comprehensive solution for sports organizers to publish events and for athletes to sign up, track their scores, and manage their participation.
**SportsReg** 是一个全栈式、优先适配移动端的 Web 应用程序，专为体育活动组织者和参与者设计。它提供了一套完整的解决方案，涵盖了活动发布、用户报名、候补管理以及积分排行榜功能。

The system features a robust **User Role System** (Admin, User, Pending), an automated **Waitlist Mechanism**, and a **Points/Leaderboard System**.
系统包含完善的 **用户角色权限**（管理员、正式用户、待审核用户）、自动化的 **候补与递补机制**，以及 **积分排行榜系统**。

---

## 🏆 Key Features / 核心功能

### 👑 Tournament Management (Admin) / 活动管理（管理员）
* **Create & Edit Tournaments**: Set time, location, duration, player limits, and detailed rules.
  **创建与编辑活动**：自定义活动时间、地点、时长、人数限制及详细规则。
* **Status Workflow**: Manually or automatically manage tournament lifecycle (`Pre-registration`, `Registration`, `Waitlist`, `Finished`).
  **状态流转管理**：手动或自动管理活动生命周期（`预报名`、`报名中`、`可候补`、`已结束`）。
* **Enrollment Management**: View participant lists, manage proxies, and handle cancellations.
  **报名管理**：查看参加人员名单，管理代报名记录，处理名单调整与取消。

### 📝 Smart Enrollment / 智能报名系统
* **Direct Registration**: Join immediately if spots are available.
  **直接报名**：名额未满时直接进入正式名单。
* **Auto-Waitlist**: Automatically placed on a waitlist if the limit is reached.
  **自动候补**：名额已满时自动进入候补队列。
* **Auto-Promotion**: If a registered player cancels, the top waitlisted candidate is automatically promoted and notified.
  **自动递补**：正式队员取消报名时，系统自动将第一顺位候补提拔为正式队员并发送通知。
* **Proxy Registration**: Users can sign up on behalf of others ("Help a friend").
  **帮人报名**：支持用户代替朋友或队友进行报名。

### 💬 Notification System / 消息通知系统
* **Real-time Alerts**: In-app notifications for status changes (e.g., "Registration Started", "Promoted from Waitlist").
  **实时提醒**：关键状态变更（如“开始报名”、“候补转成功”）会触发站内通知。
* **Global Switch**: Admin can toggle global system notifications on/off.
  **全局开关**：管理员可一键开启/关闭全局通知功能。
* **Message Center**: Dedicated inbox for users to view and delete messages.
  **消息中心**：用户专属收件箱，可查看和删除历史通知消息。

### 📊 Points & Rankings / 积分与排行
* **Leaderboard**: Global ranking based on tournament performance.
  **排行榜**：基于活动表现生成的全局用户积分排行榜。
* **History Tracking**: Users can view their full history of gains/losses.
  **历史记录**：用户可查看所有积分变动明细（胜负、参加奖励等）。
* **Automated Scoring**: Points can be awarded automatically upon tournament completion.
  **自动结算**：支持活动结束后自动发放并结算积分。

### 🎨 UI/UX & Design / 界面与体验
* **Mobile-First Design**: Optimized for mobile browsers.
  **主要适配移动端**：专为手机浏览器优化的交互设计。
* **Dark Mode**: Fully supported dark/light theme toggling.
  **深色模式**：完美支持亮色/深色主题切换。
* **Interactive Animations**: Powered by `framer-motion` for a smooth experience.
  **流畅动画**：使用 `framer-motion` 提供丝滑的过渡与交互动画体验。

---

## 🛠️ Tech Stack / 技术栈

### 💻 Frontend / 前端
* **Framework / 框架**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Language / 语言**: [TypeScript](https://www.typescriptlang.org/)
* **Styling / 样式**: [Tailwind CSS](https://tailwindcss.com/)
* **Routing / 路由**: [React Router v6](https://reactrouter.com/)
* **State Management / 状态管理**: React Context API
* **Icons / 图标库**: [Lucide React](https://lucide.dev/)
* **Charts / 图表**: [Recharts](https://recharts.org/)
* **Animations / 动画**: [Framer Motion](https://www.framer.com/motion/)

### ⚙️ Backend / 后端
* **Runtime / 运行环境**: [Node.js](https://nodejs.org/)
* **Server / 服务器**: [Express.js](https://expressjs.com/)
* **Database / 数据库**: **SQLite** (Native Node.js `node:sqlite` module / 使用 Node.js 原生 `node:sqlite` 模块)
* **Authentication / 鉴权**: JSON Web Tokens (JWT) + BCrypt for password hashing / BCrypt 密码加密
* **ORM/Query / 查询**: Direct parameterized SQL queries / 原生参数化 SQL 查询

---

## 🚀 Installation & Setup / 安装与运行指南

### Prerequisites / 前置要求
* **Node.js**: v22.5.0 or higher (Required for `node:sqlite` support).
  **Node.js**: v22.5.0 或更高版本（必须，因为使用了原生 `node:sqlite` 特性）。

### Steps / 运行步骤
1. **Clone the repository / 克隆项目**
   ```bash
   git clone <repository_url>
   cd SportsReg
   ```
2. **Install Dependencies / 安装依赖**
   ```bash
   npm install
   ```
3. **Run Development Server / 启动开发服务器**
   This command starts both the Backend (Port 3002) and Frontend (Port 3000) concurrently.
   此命令会同时启动后端API服务（端口 3002）和前端页面（端口 3000）。
   ```bash
   npm run dev
   ```
4. **Access the Application / 访问应用**
   Open your browser and navigate to `http://localhost:3000`.
   打开浏览器访问 `http://localhost:3000`。

### Default Accounts / 默认账户
When the database is initialized for the first time:
首次初始化数据库时，系统会自动创建管理员账户：
* **Admin Account / 管理员账号**:
  * Username / 用户名: `admin`
  * Password / 密码: `admin123`

---

## 🐳 Docker Deployment / Docker 部署

### Build and Run / 构建与运行
```bash
docker-compose up -d --build
```

### Reset Database (Complete Wipe) / 重置数据库（完全删除）
To completely delete the Docker-deployed database and start fresh:
如需完全删除 Docker 部署的数据库并重新开始：

1. **Stop the container / 停止容器**
   ```bash
   docker-compose down
   ```
2. **Delete the database files / 删除数据库文件**
   * **Windows PowerShell**:
     ```powershell
     Remove-Item -Recurse -Force .\data
     ```
   * **Linux/macOS**:
     ```bash
     rm -rf ./data
     ```
3. **Restart the service / 重新启动服务**
   ```bash
   docker-compose up -d
   ```

#### Quick one-liner (Windows PowerShell) / 一键快捷命令（Windows PowerShell）：
```powershell
docker-compose down; Remove-Item -Recurse -Force .\data; docker-compose up -d
```

#### Quick one-liner (Linux/macOS) / 一键快捷命令（Linux/macOS）：
```bash
docker-compose down && rm -rf ./data && docker-compose up -d
```

### Enter Container (Optional) / 进入容器（可选）
To enter the running container and inspect data:
如需进入运行中的容器查看数据：
```bash
# List running containers / 查看运行中的容器
docker ps

# Enter container shell / 进入容器 shell
docker exec -it <container_name_or_id> /bin/sh

# Inside container, database is at /app/data / 在容器内部，数据库位于 /app/data 目录
ls /app/data
```

---

## 📊 Database Schema / 数据库设计

The project uses a local `sportsreg.db` SQLite file. Key tables include:
项目使用本地 `sportsreg.db` SQLite 文件存储数据。主要表结构如下：

| Table / 表名 | Description / 描述 | Key Fields / 关键字段 |
| :--- | :--- | :--- |
| **users** | Store user accounts / 用户账户表 | `id`, `username`, `password`, `role` ('admin', 'user', 'pending'), `points` |
| **matches** | Tournament details / 活动信息表 | `id`, `title`, `status`, `max_players`, `config_json` (cost, rules / 配置Json) |
| **enrollments** | User participation / 报名记录表 | `match_id`, `user_id`, `type` ('player' / 'candidate'), `enrolled_for_name` |
| **notifications** | User messages / 消息通知表 | `user_id`, `content`, `created_at` |
| **points** | Score history log / 积分流水表 | `user_id`, `amount`, `reason`, `match_id` |
| **settings** | System config / 系统设置表 | `key`, `value` (e.g. 'notification_enabled') |

---

## 📂 Directory Structure / 目录结构

```text
SportsReg/
├── public/              # Static assets (images, faces, banners) / 静态资源
├── server/              # Backend source code / 后端源码
│   ├── routes/          # API Routes (auth, matches, users, etc.) / 路由接口
│   ├── db.js            # Database connection & init / 数据库连接与初始化
│   ├── index.js         # Entry point / 后端入口
│   └── notifications.js # Notification logic / 通知逻辑
├── src/                 # Frontend source code / 前端源码
│   ├── components/      # UI Components / 通用组件
│   ├── contexts/        # React Contexts (Auth) / 上下文
│   ├── hooks/           # Custom Hooks / 自定义Hooks
│   ├── layouts/         # Page Layouts / 布局
│   ├── lib/             # Utilities & API client / 工具函数
│   └── pages/           # Application Pages / 页面
│       ├── Home.tsx     # Homepage / 首页
│       ├── Admin.tsx    # Admin Dashboard / 管理后台
│       ├── MyScores.tsx # User Profile / 个人中心
│       └── ...
├── package.json         # Project config & scripts / 项目配置
└── README.md            # Documentation / 项目文档
```
