import { vi } from "vitest"

// Define types to match the actual VS Code webview API
export interface VSCodeWebviewApi {
	postMessage: ReturnType<typeof vi.fn>
	onDidReceiveMessage: (callback: (message: any) => void) => { dispose: () => void }
}

// Create a comprehensive mock for the VS Code webview API
export const createVSCodeMock = (): VSCodeWebviewApi => {
	const postMessageMock = vi.fn()
	const messageCallbacks: Array<(message: any) => void> = []

	return {
		postMessage: postMessageMock,
		onDidReceiveMessage: (callback) => {
			messageCallbacks.push(callback)
			return {
				dispose: () => {
					const index = messageCallbacks.indexOf(callback)
					if (index > -1) {
						messageCallbacks.splice(index, 1)
					}
				},
			}
		},
	}
}

// Default export for easy mocking
export const vscode = createVSCodeMock()
