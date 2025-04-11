/**
 * Type definition for the VS Code API
 */
declare const vscode: {
	postMessage: (message: any) => void
	getState: () => any
	setState: (state: any) => void
}
