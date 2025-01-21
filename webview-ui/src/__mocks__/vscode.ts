export const vscode = {
  postMessage: jest.fn((message: unknown) => {
    console.log('Mock vscode.postMessage called with:', message)
  }),
}

export const acquireVsCodeApi = jest.fn(() => ({
  postMessage: vscode.postMessage,
  getState: jest.fn(() => null),
  setState: jest.fn(),
}))