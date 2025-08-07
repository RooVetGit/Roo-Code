/**
 * Utility functions for handling keyboard shortcuts
 */

/**
 * Detects the operating system and returns the appropriate keyboard shortcut format
 * @param commandKey The command key (e.g., "r")
 * @returns Formatted keyboard shortcut (e.g., "⌘R" for Mac, "Ctrl+R" for others)
 */
export function getKeyboardShortcut(commandKey: string): string {
	// Check if we're on macOS
	const isMac =
		navigator.platform.toUpperCase().indexOf("MAC") >= 0 || navigator.userAgent.toUpperCase().indexOf("MAC") >= 0

	if (isMac) {
		// Use ⌘ symbol for Mac
		return `⌘${commandKey.toUpperCase()}`
	} else {
		// Use Ctrl for Windows/Linux
		return `Ctrl+${commandKey.toUpperCase()}`
	}
}

/**
 * Gets the formatted keyboard shortcut for the new task command
 * @returns Formatted keyboard shortcut
 */
export function getNewTaskShortcut(): string {
	return getKeyboardShortcut("r")
}
