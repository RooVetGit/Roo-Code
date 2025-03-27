import * as vscode from "vscode"

export interface IOutputChannelManager {
	/**
	 * Get the initialized output channel
	 * @returns vscode.OutputChannel
	 */
	getOutputChannel(): vscode.OutputChannel

	/**
	 * Append a line to the output channel
	 * @param message The message to append
	 */
	appendLine(message: string): void

	/**
	 * Show the output channel
	 */
	show(): void

	/**
	 * Clear the output channel
	 */
	clear(): void
}
