import * as vscode from "vscode"

/**
 * Options for configuring the UserInteractionProvider
 */
interface UserInteractionOptions {
	/**
	 * Callback invoked when user interaction is detected
	 */
	onUserInteraction: () => void
	/**
	 * Function to check if interaction should be suppressed
	 */
	getSuppressFlag: () => boolean
	/**
	 * Whether auto approval is enabled
	 */
	autoApproval: boolean
	/**
	 * Whether auto focus is enabled
	 */
	autoFocus: boolean
}

/**
 * Manages user interaction listeners for the diff view provider.
 * Handles detection of user interactions with text editors, tabs, and tab groups
 * to disable auto-focus behavior when appropriate.
 */
export class UserInteractionProvider {
	private userInteractionListeners: vscode.Disposable[] = []
	private options: UserInteractionOptions

	constructor(options: UserInteractionOptions) {
		this.options = options
	}

	/**
	 * Updates the options for the provider
	 */
	updateOptions(options: Partial<UserInteractionOptions>): void {
		this.options = { ...this.options, ...options }
	}

	/**
	 * Enables user interaction listeners to detect when auto-focus should be disabled.
	 * Only sets up listeners if auto approval and auto focus are both enabled.
	 */
	enable(): void {
		this.resetListeners()

		// If auto approval is disabled or auto focus is disabled, we don't need to add listeners
		if (!this.options.autoApproval || !this.options.autoFocus) {
			return
		}

		// Set up listeners for various user interactions
		const changeTextEditorSelectionListener = vscode.window.onDidChangeTextEditorSelection((_e) => {
			// If the change was done programmatically, we don't want to suppress focus
			if (this.options.getSuppressFlag()) {
				return
			}
			// Consider this a "user interaction"
			this.options.onUserInteraction()
			this.resetListeners()
		}, this)

		const changeActiveTextEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
			// If the change was done programmatically, or if there is no editor, we don't want to suppress focus
			if (this.options.getSuppressFlag() || !editor) {
				return
			}
			// Consider this a "user interaction"
			this.options.onUserInteraction()
			this.resetListeners()
		}, this)

		const changeTabListener = vscode.window.tabGroups.onDidChangeTabs((_e) => {
			// If the change was done programmatically, we don't want to suppress focus
			if (this.options.getSuppressFlag()) {
				return
			}
			// Consider this a "user interaction"
			this.options.onUserInteraction()
			this.resetListeners()
		}, this)

		const changeTabGroupListener = vscode.window.tabGroups.onDidChangeTabGroups((_e) => {
			// If the change was done programmatically, we don't want to suppress focus
			if (this.options.getSuppressFlag()) {
				return
			}
			// Consider this a "user interaction"
			this.options.onUserInteraction()
			this.resetListeners()
		}, this)

		this.userInteractionListeners.push(
			changeTextEditorSelectionListener,
			changeActiveTextEditorListener,
			changeTabListener,
			changeTabGroupListener,
		)
	}

	/**
	 * Resets (removes) all user interaction listeners to prevent memory leaks.
	 * This is called when the diff editor is closed or when user interaction is detected.
	 */
	private resetListeners(): void {
		this.userInteractionListeners.forEach((listener) => listener.dispose())
		this.userInteractionListeners = []
	}

	/**
	 * Disposes of all listeners and cleans up resources.
	 */
	dispose(): void {
		this.resetListeners()
	}
}
