import * as vscode from "vscode"

interface VirtualContentData {
	content: string
	language?: string // Optional language for syntax highlighting
}

// Simple in-memory storage for virtual document content
const virtualContentStore = new Map<string, VirtualContentData>()

export class VirtualContentProvider implements vscode.TextDocumentContentProvider {
	// Optional: Add an event emitter if you need to signal updates for live changes
	// private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	// readonly onDidChange = this._onDidChange.event;

	provideTextDocumentContent(uri: vscode.Uri): string {
		const contentPath = uri.path
		const storedData = virtualContentStore.get(contentPath)
		return storedData?.content || `// Error: Could not find content for URI: ${uri.toString()}`
	}

	static addContent(scheme: string, content: string, language?: string): vscode.Uri {
		const id = Date.now().toString() // Simple unique ID
		let path

		// Construct path, incorporating language if provided (primarily for tool outputs)
		if (language) {
			path = `fragment-${id}.${language.toLowerCase() || "txt"}`
		} else {
			// For API requests or content without a specific language
			path = `content-${id}.md` // Default to markdown for API requests
		}

		virtualContentStore.set(path, { content, language })

		// Optional: Clean up old entries after a while
		// The key for deletion should be the `path` used to store the content
		setTimeout(() => virtualContentStore.delete(path), 60 * 1000 * 5) // Clear after 5 minutes

		return vscode.Uri.parse(`${scheme}:${path}`)
	}

	// Helper to signal a change in a document's content, if needed for live updates
	// public signalChange(uri: vscode.Uri) {
	//  this._onDidChange.fire(uri);
	// }
}
