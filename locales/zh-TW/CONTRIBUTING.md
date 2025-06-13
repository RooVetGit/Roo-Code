[English](../../CONTRIBUTING.md) • [Català](../ca/CONTRIBUTING.md) • [Deutsch](../de/CONTRIBUTING.md) • [Español](../es/CONTRIBUTING.md) • [Français](../fr/CONTRIBUTING.md) • [हिंदी](../hi/CONTRIBUTING.md) • [Italiano](../it/CONTRIBUTING.md) • [Nederlands](../nl/CONTRIBUTING.md) • [Русский](../ru/CONTRIBUTING.md)

[日本語](../ja/CONTRIBUTING.md) • [한국어](../ko/CONTRIBUTING.md) • [Polski](../pl/CONTRIBUTING.md) • [Português (BR)](../pt-BR/CONTRIBUTING.md) • [Türkçe](../tr/CONTRIBUTING.md) • [Tiếng Việt](../vi/CONTRIBUTING.md) • [简体中文](../zh-CN/CONTRIBUTING.md) • <b>繁體中文</b>

# 參與 Roo Code 貢獻

Roo Code 是一個由社群驅動的專案，我們深深重視每一份貢獻。為了簡化協作流程，我們採用 [Issue-First](#issue-first-方式) 原則，這表示所有 [Pull Request (PR)](#提交-pull-request) 必須先關聯至 GitHub Issue。請仔細閱讀本指南。

## 目錄

- [貢獻前須知](#貢獻前須知)
- [尋找與規劃你的貢獻](#尋找與規劃你的貢獻)
    - [功能請求 vs. 詳細功能提案](#功能請求-vs-詳細功能提案)
- [開發與提交流程](#開發與提交流程)
- [法律聲明](#法律聲明)

## 貢獻前須知

### 1. 行為準則

所有貢獻者必須遵守我們的[行為準則](./CODE_OF_CONDUCT.md)。

### 2. 專案藍圖

我們的藍圖指引專案方向。請將你的貢獻與這些關鍵目標保持一致：

### 可靠性優先

- 確保差異編輯和命令執行始終可靠
- 減少阻礙常規使用的摩擦點
- 確保在所有語言環境和平台上順暢運行
- 擴展對各種 AI 供應商和模型的強大支援

### 增強使用者體驗

- 簡化使用者介面，提高清晰度和直覺性
- 持續改進工作流程，滿足開發者對日常工具的高期望

### 引領代理效能

- 建立全面的評估基準（evals）衡量實際工作中的生產力
- 讓每個人都能輕鬆執行和解讀這些評估
- 提供明顯提升評分的改進

在 PR 中請提及與這些領域的關聯。

### 3. 加入 Roo Code 社群

- **主要方式：** 加入我們的 [Discord](https://discord.gg/roocode) 並私訊 **Hannes Rudolph (`hrudolph`)**。
- **替代方式：** 有經驗的貢獻者可透過 [GitHub Projects](https://github.com/orgs/RooCodeInc/projects/1) 直接參與。

## 尋找與規劃你的貢獻

### 貢獻類型

- **Bug 修正：** 解決程式碼問題。
- **新功能：** 新增功能。
- **文件：** 完善指南和提高清晰度。

### Issue-First 方式

所有貢獻必須從 GitHub Issue 開始。

- **檢查現有 issue：** 搜尋 [GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues)。
- **建立 issue：** 使用適當範本：
    - **Bug：** 「Bug Report」範本。
    - **功能：** 「Detailed Feature Proposal」範本。開始前需獲得批准。（見下方[功能請求 vs. 詳細功能提案](#功能請求-vs-詳細功能提案)）
- **認領 issue：** 留言並等待正式分配。

**未關聯已批准 issue 的 PR 可能會被關閉。**

### 決定要做什麼

- 查看 [GitHub 專案](https://github.com/orgs/RooCodeInc/projects/1) 中未分配的「Good First Issues」。
- 文件相關，請訪問 [Roo Code Docs](https://github.com/RooCodeInc/Roo-Code-Docs)。

### 回報 Bug

- 先檢查是否已有相關報告。
- 使用 [「Bug Report」範本](https://github.com/RooCodeInc/Roo-Code/issues/new/choose) 建立新 bug 報告。
- **安全問題：** 透過 [security advisories](https://github.com/RooCodeInc/Roo-Code/security/advisories/new) 私下回報。

### 功能請求 vs. 詳細功能提案

理解這兩種提交類型的差異對於選擇正確的方法至關重要：

#### 功能請求（GitHub Discussions）

**目的**：分享一般性想法或建議，無需詳細規劃。

**如何提交**：

- 導覽至 [GitHub Discussions - Feature Requests](https://github.com/RooCodeInc/Roo-Code/discussions/categories/feature-requests)
- 或在 issues 部分點擊「New Issue」按鈕時點擊「Feature Request」連結

**使用場景**：

- 你的想法尚未完全成型
- 你希望獲得社群的意見或回饋
- 你提出想法但沒有親自實施的計畫

#### 詳細功能提案（GitHub Issues）

**目的**：明確概述的功能，旨在獲得批准後立即實施。

**如何提交**：

- 導覽至 [GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues)
- 點擊「New Issue」並選擇「Detailed Feature Proposal」範本

**使用場景**：

- 你的功能已完全規劃並準備好接受批准
- 你或其他人打算很快實施該功能
- 開始開發前需要正式批准

**注意**：詳細功能提案必須在開始實施前由維護者批准和分配，如上述 [Issue-First 方式](#issue-first-方式)部分所述。

![Issue 範本選擇](placeholder-for-issue-template-selection-image)

**重要**：選擇錯誤的範本可能導致你的提交被重新導向或關閉。不要將 Bug 報告用於功能想法。

## 開發與提交流程

### 開發環境設定

1. **Fork & Clone：**

```
git clone https://github.com/你的帳號/Roo-Code.git
```

2. **安裝相依套件：**

```
npm run install:all
```

3. **除錯：** 在 VS Code 中按 `F5` 開啟。

### 程式碼規範

- 每個 PR 專注於一個功能或修正。
- 遵循 ESLint 和 TypeScript 最佳實踐。
- 撰寫清晰的提交訊息，引用相關 issue（如 `Fixes #123`）。
- 提供完整測試（`npm test`）。
- 提交前先在最新 `main` 分支上進行 rebase。

### 提交 Pull Request

- 如需早期回饋，可先提交**草稿 PR**。
- 清晰描述你的更改，遵循 Pull Request 範本。
- 為 UI 變更提供截圖/影片。
- 說明是否需要更新文件。

### Pull Request 政策

- 必須引用已批准並分配的 issue。
- 不遵守政策的 PR 可能會被關閉。
- PR 應通過 CI 測試，符合藍圖，並有清晰文件。

### 審查流程

- **每日篩查：** 維護者快速檢查。
- **每週深入審查：** 全面評估。
- **根據回饋快速迭代**。

## 法律聲明

提交貢獻即表示你同意你的貢獻將基於 Apache 2.0 授權條款，與 Roo Code 的授權一致。
