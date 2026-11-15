# 共作 / Gongzuo GitHub 接管与 CI 补验

日期：2026-11-15。项目：`bGl5b25nanVu/agent-team-workbench`。

## 原始工作与交付记录

- 原工作区：`/workspace/gongzuo-resume-20261112/repo`；功能分支：`feat/team-workbench`。
- 已恢复并推送完整既有源码与图片提交，最新的原始实现提交为 `21067e4aaeeb4d999ae9d3af8419ff4a3f179292`。没有重新创建历史文件或逐张上传 Blob。
- 对 `dev` 的实现 PR 为 [#1](https://github.com/bGl5b25nanVu/agent-team-workbench/pull/1)。不直接修改 `main`。
- 原 `final-status.json` 对应 2026-11-12 较早的失败尝试；随后形成的 `task-final/result.json`、`final-ui/result.json` 和 `visual-final/result.json` 记录了修复后通过的浏览器验收。须按证据生成时间区分，不能以旧状态覆盖较新结果。
- Fork 初始未启用 Actions 工作流。用户授权 GitHub CLI 的 `workflow` scope 后，通过仓库 Actions 权限设置激活 `Test` / `Release` 工作流，并重新触发 PR #1。

## 首轮 GitHub CI 核查与增量修复

初始 CI：[Test run #43703788790](https://github.com/bGl5b25nanVu/agent-team-workbench/actions/runs/43703788790)。最先确认两个失败原因：

1. `Leak scan`：旧 `draft-marker` 规则把包含“草稿”的正常产品说明误判为待办草稿。规则现在保留英文待补充标记与显式中文草稿标签的拦截，不再拦截普通正文对草稿功能的描述；完整追踪文件扫描在本地为 `must fix: 0`。
2. DSH `0.2.0-rc.2` 的图片 HTTP 桥接测试：旧 WebServer 没有 `getOrigin()`，但具有 `port`。测试使用可用时的 `getOrigin()`，否则使用测试明确绑定的 `127.0.0.1` 和监听端口；最新 DSH 上针对该测试的 2 项断言通过。

为了提供安装包交付，CI 在 Windows、macOS arm64/x64 和 Linux 的安装及验证步骤通过后，会上传保留 14 天的 GitHub Actions artifact；未通过验证的作业不发布安装包。原 CI 仍负责完整版本组合测试、移动端类型检查、桌面包验证、Docker 和最终 `Test result` 门禁。

本说明记录修复缘由，不应替代 GitHub 上最新 PR/CI 检查。真实付费模型、实际 Android APK 安装以及未实现的硬预算等能力，不能因为模拟浏览器验收通过而宣称已验收。
