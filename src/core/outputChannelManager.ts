import * as vscode from "vscode"
import { IOutputChannelManager } from "./interfaces/IOutputChannelManager"

export class OutputChannelManager implements IOutputChannelManager {
	private static instance: OutputChannelManager
	private outputChannel: vscode.OutputChannel

	private constructor() {
		this.outputChannel = vscode.window.createOutputChannel("Roo-Code")
	}

	/**
	 * Get the singleton instance of OutputChannelManager
	 * @returns OutputChannelManager
	 */
	public static getInstance(): OutputChannelManager {
		if (!OutputChannelManager.instance) {
			OutputChannelManager.instance = new OutputChannelManager()
		}
		return OutputChannelManager.instance
	}

	/**
	 * Get the initialized output channel
	 * @returns vscode.OutputChannel
	 */
	public getOutputChannel(): vscode.OutputChannel {
		return this.outputChannel
	}

	/**
	 * Append a line to the output channel
	 * TODO: Refactor and use this rather than using outputchannel
	 * @param message The message to append
	 */
	public appendLine(message: string): void {
		this.outputChannel.appendLine(message)
	}

	/**
	 * Show the output channel
	 */
	public show(): void {
		this.outputChannel.show()
	}

	/**
	 * Clear the output channel
	 */
	public clear(): void {
		this.outputChannel.clear()
	}
}
