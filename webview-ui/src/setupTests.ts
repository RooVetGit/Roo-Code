import '@testing-library/jest-dom'

// VSCode APIのモック
const mockVSCodeApi = {
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn(),
}

// グローバルなacquireVsCodeApi関数の定義
global.acquireVsCodeApi = jest.fn(() => mockVSCodeApi)

// webview-ui-toolkitのモック
jest.mock('@vscode/webview-ui-toolkit', () => ({
  provideVSCodeDesignSystem: jest.fn(),
  vsCodeButton: jest.fn(),
  vsCodeTextField: jest.fn(),
}))

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
  mockVSCodeApi.postMessage.mockClear()
  mockVSCodeApi.getState.mockClear()
  mockVSCodeApi.setState.mockClear()
})
