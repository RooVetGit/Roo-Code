# Traditional Chinese (zh-TW) Translation Guidelines

## Key Terminology

| English Term  | Use (zh-TW)   | Avoid (Mainland) | Notes                            |
| ------------- | ------------- | ---------------- | -------------------------------- |
| file          | 檔案          | 文件             |                                  |
| task          | 工作          | 任務             |                                  |
| project       | 專案          | 項目             |                                  |
| configuration | 設定          | 配置             |                                  |
| server        | 伺服器        | 服務器           |                                  |
| import/export | 匯入/匯出     | 導入/導出        |                                  |
| account       | 帳號          | 帳戶             | Use 帳號 for user accounts       |
| connect       | 連線          | 連接             | Use 連線 for network connections |
| sign in       | 登入          | 連接到           | Use 登入 for authentication      |
| history       | 歷史紀錄      | 歷史             | Add 紀錄 for clarity             |
| token         | Token         | Tokens           | Keep singular form, no 's'       |
| pin/unpin     | 釘選/取消釘選 | 置頂/取消置頂    | Use 釘選 for UI pinning          |
| enhance       | 強化          | 增強             | Use 強化 for improvements        |
| prompt        | 提示詞        | 提示             | Add 詞 for AI prompts            |
| documentation | 說明文件      | 文件             | Use 說明文件 for docs            |
| endpoint      | 端點          | 站點             | Use 端點 for API endpoints       |
| approve       | 核准          | 批准             | Use 核准 for approvals           |
| global        | 全域          | 全局             | Use 全域 for scope               |

## Formatting Rules

- Add spaces between Chinese and English/numbers: "AI 驅動" (not "AI驅動")
- Use Traditional Chinese quotation marks: 「範例文字」(not "範例文字")
- Use Taiwanese computing conventions rather than mainland terminology
- Keep English technical terms (like "Token", "API") in English when commonly used
- Add spaces around English abbreviations: "API 金鑰" (not "API金鑰")

## Consistency Guidelines

1. **Formality Level**: Use respectful "您" instead of casual "你" for user-facing text
2. **Punctuation**: Use full-width punctuation marks (，、。！？) in Chinese text
3. **Technical Terms**: Keep commonly-used English terms (API, Token, URL) in English
4. **Clarity**: Add clarifying words when needed (e.g., 歷史紀錄 instead of just 歷史)
5. **Context**: Consider the UI context - shorter terms for buttons, clearer terms for descriptions

## Common Patterns

### Action Verbs

- Create: 建立
- Build: 建置
- Delete: 刪除
- Remove: 移除
- Update: 更新
- Modify: 修改
- Save: 儲存
- Cancel: 取消
- Confirm: 確認

### UI Elements

- Button: 按鈕
- Menu: 選單
- Dialog: 對話框
- Tab: 分頁
- Panel: 面板
- Sidebar: 側邊欄

### Status Messages

- Loading: 載入中
- Processing: 處理中
- Completed: 已完成
- Failed: 失敗
- Pending: 待處理

## Examples of Good Translations

- ❌ "使用額外內容增強提示"
- ✅ "使用額外內容強化提示詞"

- ❌ "線上工作歷史記錄" (typo)
- ✅ "線上工作歷史紀錄"

- ❌ "連接到 Roo Code Cloud"
- ✅ "登入 Roo Code Cloud" (clearer intent)

- ❌ "基於工作、Token 和成本的使用指標"
- ✅ "基於工作任務、Token 和成本的用量指標" (more precise)

## Review Checklist

Before submitting translations:

- [ ] Check for typos
- [ ] Verify consistent terminology throughout all files
- [ ] Ensure proper spacing between Chinese and English text
- [ ] Confirm appropriate formality level (您 vs 你)
- [ ] Validate that technical terms are handled consistently
- [ ] Review context to ensure translations make sense in the UI
