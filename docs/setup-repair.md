# Windows 安装文档修复任务

修复 DevSpace Windows 安装文档，使一个没有本机历史文件、只从远端仓库 clone 的执行 Agent，能够完成本地 DevSpace、Cloudflare Named Tunnel、DevSpace 登录自启和 cloudflared 系统自启的安装与验收。修改前先核对当前仓库布局、Git 跟踪状态、CLI 行为、启动脚本和 Cloudflare 官方流程；只处理安装与部署文档及其必要后果。

## 已核对事实

- Git 仓库根目录是 clone 后的项目目录；仓库上一级目录中的旧文件不是项目内容，不能成为安装依赖。
- `register-devspace-task.ps1`、`start-devspace.mjs` 和 `start-devspace.ps1` 已位于仓库根目录，并存在于远端 `main` 当前提交中。
- `node .\dist\cli.js init` 只创建或更新配置和认证状态，不启动服务，并会在交互终端显示 Owner password。
- DevSpace 计划任务由 `register-devspace-task.ps1` 注册，触发器是当前 Windows 用户登录；它不是登录前启动的系统服务。
- dashboard-managed Cloudflare Tunnel 的 Windows 安装命令含 Tunnel token，并将 cloudflared 安装为 Windows 服务。locally-managed Tunnel 的 `config.yml` 流程是另一种部署方式。

## 待修复问题

### 问题 1：安装路径隐含本机旧布局

- 问题位置：`README.md` 与 `docs/setup.md` 的仓库准备和启动脚本说明。
- 问题原因：本机仓库外还存在旧版启动脚本，容易让维护者误以为 fresh clone 依赖上一级目录；其他用户 clone 后不会获得这些文件。
- 修复目标：所有命令都从 clone 后的仓库根目录执行；文档明确列出并检查仓库内三个启动脚本，不引用仓库外路径。

### 问题 2：初始化后缺少启动步骤

- 问题位置：`docs/setup.md` 的首次部署与本地健康检查。
- 问题原因：`init` 完成后服务尚未运行，立即访问 `/healthz` 必然失败。
- 修复目标：先在独立本地终端运行前台启动器，确认实际配置端口返回 HTTP 200，再停止前台实例并进入持久化启动配置。

### 问题 3：固定端口与凭据边界不可靠

- 问题位置：两份安装文档中的 `7676` 命令和 `init` 操作。
- 问题原因：已有配置可以使用其他端口；`init` 会显示 Owner password，不应通过会回传终端输出的远程 Agent 通道执行。
- 修复目标：以 `config get` 返回的 host/port 为后续命令和 Cloudflare route 的唯一依据；需要初始化时由用户在本地交互终端完成，Agent 不读取、转录或保存凭据。

### 问题 4：Cloudflare 两种管理模式混用

- 问题位置：Cloudflare 安装步骤与官方参考链接。
- 问题原因：主流程使用 dashboard-managed Tunnel 和 token service install，却链接到 locally-managed Tunnel 的 `config.yml` 服务流程，Agent 可能创建第二套配置。
- 修复目标：主流程只描述 dashboard-managed Named Tunnel；用户执行控制台生成的含 token 命令，Agent仅验证服务状态和 Published application route。

### 问题 5：前台实例与计划任务缺少交接

- 问题位置：本地验证与 `register-devspace-task.ps1` 之间。
- 问题原因：前台实例仍占用端口时，计划任务启动器会退出，导致“端口可用”被误判为计划任务已接管服务。
- 修复目标：注册计划任务前明确停止前台诊断实例；注册后分别验证任务处于 Running、实际端口正在监听以及本地健康检查成功。

### 问题 6：自启验收不足并可能泄露 token

- 问题位置：DevSpace/cloudflared 自启检查与完成条件。
- 问题原因：仅检查对象存在不能证明重启后恢复；输出 cloudflared 服务完整 `PathName` 可能暴露含 token 的命令行。
- 修复目标：常规检查只读取服务名称、状态与启动模式；区分“已配置”与“已通过重启/重新登录验证”，并明确 DevSpace 只有在目标用户登录后才启动。

## 验收标准

1. 一个全新目录只 clone 远端仓库后，仓库根目录内即可找到构建、前台启动和计划任务注册所需文件。
2. 文档按“前置检查 → clone/build → 初始化 → 本地前台验证 → Tunnel/route → 设置 publicBaseUrl → 持久化启动 → 端到端验证”的依赖顺序执行。
3. 所有运行地址使用实际配置端口；示例值清楚标为示例。
4. Agent 不通过其工具读取 Owner password 或 Tunnel token，也不输出可能包含 token 的服务命令行。
5. dashboard-managed 与 locally-managed Cloudflare 流程不再混用。
6. 完成条件同时覆盖本地 HTTP、公开 HTTP、远程 MCP、DevSpace 登录自启和 cloudflared 自动服务；无法执行重启验证时明确报告为未验证。

## 验证方式

验证方式：使用远端 Git 树、脚本语法检查、文档搜索和最终 diff 作为完成证据。

- 使用 `git ls-tree` 或等价命令确认三个启动脚本存在于远端当前提交。
- 检查文档内没有依赖仓库外绝对路径，没有把 `init` 当作启动命令，没有在凭据检查中输出服务完整命令行。
- 解析 PowerShell 脚本并执行 `node --check .\start-devspace.mjs`，但不注册、停止或重启本机任务和服务。
- 运行 `git diff --check`，并检查最终 diff 只包含本任务需要的文档修改。

## 约束与边界

- 保留用户现有工作区修改，不改动 Cloudflare、Windows 服务、计划任务或本机 DevSpace 配置。
- 不把仓库外旧脚本复制进项目；仓库内已跟踪脚本是唯一受支持入口。
- 不执行部署、发布、Git 提交或推送。
- 不做与 fresh clone 安装契约无关的代码重构。

## 完成报告

说明远端脚本核对结论、修改的文档、执行的静态验证，以及实际重启、Cloudflare 账号操作或远程 MCP 验收中尚未执行的部分。
