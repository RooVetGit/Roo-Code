module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    // モジュールのモック
    "^@vscode/webview-ui-toolkit/react$": "<rootDir>/src/__mocks__/vscode-webview-ui-toolkit.ts",
    "^vscrui$": "<rootDir>/src/__mocks__/vscrui.ts",
    "^hast-util-to-text$": "<rootDir>/src/__mocks__/hast-util-to-text.ts",
  },
  transformIgnorePatterns: [
    // node_modulesのトランスパイル設定
    "node_modules/(?!(@vscode/webview-ui-toolkit|vscrui)/)"
  ],
  setupFilesAfterEnv: [
    "<rootDir>/src/setupTests.ts"
  ],
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{ts,tsx}"
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/__mocks__/**/*"
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}