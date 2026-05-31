# SportsReg - Sports Tournament Registration System
# SportsReg - 体育活动报名系统

[English](#english) | [中文](#chinese)

---

<a name="english"></a>
## 🇬🇧 English

### Project Overview
**SportsReg** is a full-stack, mobile-first web application designed to manage sports tournaments, user registrations, and leaderboards. It provides a comprehensive solution for sports organizers to publish events and for athletes to sign up, track their scores, and manage their participation.

The system features a robust **User Role System** (Admin, User, Pending), an automated **Waitlist Mechanism**, and a **Points/Leaderboard System**.

### Key Features

#### 🏆 Tournament Management (Admin)
-   **Create & Edit Tournaments**: Set time, location, duration, player limits, and detailed rules.
-   **Status Workflow**: Manually or automatically manage tournament lifecycle:
    -   `Pre-registration`: Preview mode.
    -   `Registration`: Open for sign-ups.
    -   `Waitlist`: Full, but accepting backups.
    -   `Finished`: Settlement and archiving.
-   **Enrollment Management**: View participant lists, manage proxies, and handle cancellations.

#### 📝 User Registration & Enrollment
-   **User System**: Secure registration/login (JWT) with Admin approval workflow for new accounts.
-   **Smart Enrollment**:
    -   **Direct Registration**: Join immediately if spots are available.
    -   **Auto-Waitlist**: Automatically placed on a waitlist if the limit is reached.
    -   **Auto-Promotion**: If a registered player cancels, the top waitlisted candidate is automatically promoted and notified.
    -   **Proxy Registration**: Users can sign up on behalf of others ("Help a friend").

#### 💬 Notification System
-   **Real-time Alerts**: In-app notifications for status changes (e.g., "Registration Started", "Promoted from Waitlist").
-   **Global Switch**: Admin can toggle global system notifications.
-   **Message Center**: Dedicated inbox for users to view and delete messages.

#### 📊 Points & Rankings
-   **Leaderboard**: Global ranking based on tournament performance.
-   **History Tracking**: Users can view their full history of gains/losses.
-   **Automated Scoring**: Points can be awarded automatically upon tournament completion.

#### 🎨 UI/UX
-   **Mobile-First Design**: Optimized for mobile browsers.
-   **Dark Mode**: Fully supported dark/light theme toggling.
-   **Interactive Animations**: Powered by `framer-motion` for a smooth experience.

---

### Tech Stack

#### Frontend
-   **Framework**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Routing**: [React Router v6](https://reactrouter.com/)
-   **State Management**: React Context API
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **Charts**: [Recharts](https://recharts.org/)
-   **Animations**: [Framer Motion](https://www.framer.com/motion/)

#### Backend
-   **Runtime**: [Node.js](https://nodejs.org/)
-   **Server**: [Express.js](https://expressjs.com/)
-   **Database**: **SQLite** (Native Node.js `node:sqlite` module) - No external DB server required.
-   **Authentication**: JSON Web Tokens (JWT) + BCrypt for password hashing.
-   **ORM/Query**: Direct SQL with parameterized queries for performance and safety.

---

### Installation & Setup

#### Prerequisites
-   **Node.js**: v22.5.0 or higher (Required for `node:sqlite` support).

#### Steps
1.  **Clone the repository**
    ```bash
    git clone <repository_url>
    cd SportsReg
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run Development Server**
    This command starts both the Backend (Port 3002) and Frontend (Port 3000) concurrently.
    ```bash
    npm run dev
    ```

4.  **Access the Application**
    Open your browser and navigate to `http://localhost:3000`.

#### Default Accounts
When the database is initialized for the first time:
-   **Admin Account**:
    -   Username: `admin`
    -   Password: `admin123`

---

### Docker Deployment

#### Build and Run

```bash
cd SportsReg
docker-compose up -d --build
```

#### Reset Database (Complete Wipe)

To completely delete the Docker-deployed database and start fresh:

1.  **Stop the container**
    ```bash
    docker-compose down
    ```

2.  **Delete the database files**
    ```bash
    # Windows PowerShell
    Remove-Item -Recurse -Force .\data

    # Linux/macOS
    rm -rf ./data
    ```

3.  **Restart the service**
    ```bash
    docker-compose up -d
    ```

**Quick one-liner (Windows PowerShell):**
```powershell
docker-compose down; Remove-Item -Recurse -Force .\data; docker-compose up -d
```

**Quick one-liner (Linux/macOS):**
```bash
docker-compose down && rm -rf ./data && docker-compose up -d
```

#### Enter Container (Optional)

To enter the running container and inspect data:

```bash
# List running containers
docker ps

# Enter container shell
docker exec -it <container_name_or_id> /bin/sh

# Inside container, database is at /app/data
ls /app/data
```

---

### Database Schema

The project uses a local `sportsreg.db` SQLite file. Key tables include:

| Table | Description | Key Fields |
| :--- | :--- | :--- |
| **users** | Store user accounts | `id`, `username`, `password`, `role` ('admin', 'user', 'pending'), `points` |
| **matches** | Tournament details | `id`, `title`, `status`, `max_players`, `config_json` (stores cost, rules) |
| **enrollments**| User participation | `match_id`, `user_id`, `type` ('player', 'candidate'), `enrolled_for_name` |
| **notifications**| User messages | `user_id`, `content`, `created_at` |
| **points** | Score history log | `user_id`, `amount`, `reason`, `match_id` |
| **settings** | System config | `key`, `value` (e.g., 'notification_enabled') |

---

<a name="chinese"></a>
## 🇨🇳 中文

### 项目概述
**SportsReg** 是一个全栈式、优先适配移动端的 Web 应用程序，专为体育活动组织者和参与者设计。它提供了一套完整的解决方案，涵盖了活动发布、用户报名、候补管理以及积分排行榜功能。

该系统具备强大的 **用户角色权限**（管理员、正式用户、待审核用户）、自动化的 **候补机制**，以及 **积分/排行榜系统**。

### 核心功能

#### 🏆 活动管理 (管理员)
-   **创建与编辑活动**：自定义活动时间、地点、时长、人数限制及详细规则。
-   **状态流转**：手动或自动管理活动生命周期：
    -   `预报名` (Pre-registration)：预览阶段。
    -   `报名中` (Registration)：正式开放报名。
    -   `可候补` (Waitlist)：名额已满，接受候补。
    -   `已结束` (Finished)：活动结算与归档。
-   **报名管理**：查看参加人员名单，管理代报名记录，处理名单调整。

#### 📝 用户注册与报名
-   **用户系统**：安全的注册/登录（JWT），包含管理员审核机制（新注册用户默认为 Pending 状态）。
-   **智能报名系统**：
    -   **直接报名**：名额未满时直接从名单。
    -   **自动候补**：名额已满时自动进入候补队列。
    -   **自动递补**：当正式队员取消报名时，系统自动将第一顺位候补提拔为正式队员，并发送通知。
    -   **帮人报名**：支持用户代替朋友或队友进行报名。

#### 💬 消息通知系统
-   **实时提醒**：关键状态变更（如“开始报名”、“候补转成功”）会触发站内通知。
-   **全局开关**：管理员可一键开启/关闭全局通知功能。
-   **消息中心**：用户拥有专属收件箱，可查看和删除历史消息。

#### 📊 积分与排行
-   **排行榜**：基于活动表现生成的全局用户积分排名。
-   **历史记录**：用户可查看所有积分变动明细（胜负、参加奖励等）。
-   **自动结算**：支持活动结束后自动发放积分。

#### 🎨 界面体验 (UI/UX)
-   **主要适配移动端**：专为手机浏览器优化的交互设计。
-   **深色模式**：完美支持亮色/深色主题切换。
-   **流畅动画**：使用 `framer-motion` 在页面跳转和列表加载时提供丝滑的视觉体验。

---

### 技术栈

#### 前端 (Frontend)
-   **框架**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
-   **语言**: [TypeScript](https://www.typescriptlang.org/)
-   **样式**: [Tailwind CSS](https://tailwindcss.com/)
-   **路由**: [React Router v6](https://reactrouter.com/)
-   **状态管理**: React Context API
-   **图标库**: [Lucide React](https://lucide.dev/)
-   **图表**: [Recharts](https://recharts.org/)
-   **动画**: [Framer Motion](https://www.framer.com/motion/)

#### 后端 (Backend)
-   **运行环境**: [Node.js](https://nodejs.org/)
-   **服务器**: [Express.js](https://expressjs.com/)
-   **数据库**: **SQLite** (使用 Node.js 原生 `node:sqlite` 模块) - 无需安装额外的数据库软件。
-   **鉴权**: JSON Web Tokens (JWT) + BCrypt 密码加密。
-   **ORM/查询**: 使用原生参数化 SQL 查询，确保性能与安全。

---

### 安装与运行指南

#### 前置要求
-   **Node.js**: v22.5.0 或更高版本 (必须，因为使用了 `node:sqlite` 特性)。

#### 步骤
1.  **克隆项目**
    ```bash
    git clone <repository_url>
    cd SportsReg
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **启动开发服务器**
    此命令会同时启动后端API服务 (端口 3002) 和 前端页面 (端口 3000)。
    ```bash
    npm run dev
    ```

4.  **访问应用**
    打开浏览器访问 `http://localhost:3000`。

#### 默认账户
首次初始化数据库时，系统会自动创建管理员账户：
-   **管理员账号**:
    -   用户名: `admin`
    -   密码: `admin123`

---

### Docker 部署

#### 构建与运行

```bash
cd SportsReg
docker-compose up -d --build
```

#### 重置数据库（完全删除）

如需完全删除 Docker 部署的数据库并重新开始：

1.  **停止容器**
    ```bash
    docker-compose down
    ```

2.  **删除数据库文件**
    ```bash
    # Windows PowerShell
    Remove-Item -Recurse -Force .\data

    # Linux/macOS
    rm -rf ./data
    ```

3.  **重新启动服务**
    ```bash
    docker-compose up -d
    ```

**快捷一键命令（Windows PowerShell）：**
```powershell
docker-compose down; Remove-Item -Recurse -Force .\data; docker-compose up -d
```

**快捷一键命令（Linux/macOS）：**
```bash
docker-compose down && rm -rf ./data && docker-compose up -d
```

#### 进入容器（可选）

如需进入运行中的容器查看数据：

```bash
# 查看运行中的容器
docker ps

# 进入容器 shell
docker exec -it <容器名或ID> /bin/sh


# 在容器内部，数据库位于 /app/data 目录
ls /app/data
# 删除数据库文件（在容器内执行）
rm -rf /app/data/*
# 退出容器
exit

---

### 数据库设计

项目使用本地 `sportsreg.db` SQLite 文件存储数据。主要表结构如下：

| 表名 (Table) | 描述 | 关键字段 |
| :--- | :--- | :--- |
| **users** | 用户账户表 | `id`, `username`, `password`, `role` (角色), `points` |
| **matches** | 活动信息表 | `id`, `title`, `status`, `max_players`, `config_json` (配置Json) |
| **enrollments**| 报名记录表 | `match_id`, `user_id`, `type` ('player'正式/'candidate'候补), `enrolled_for_name` |
| **notifications**| 消息通知表 | `user_id`, `content`, `created_at` |
| **points** | 积分流水表 | `user_id`, `amount` (变动值), `reason`, `match_id` |
| **settings** | 系统设置表 | `key`, `value` (如 'notification_enabled') |

---

### 目录结构 (Directory Structure)

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
