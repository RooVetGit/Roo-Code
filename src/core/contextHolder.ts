import * as vscode from "vscode"
/**
 * Interface for the vscode.ExtensionContext
 */
export interface IExtensionContext {
	/**
	 * The absolute file path of the extension's directory.
	 */
	readonly extensionPath: string
	/**
	 * The absolute file path of the extension's folder.
	 */
	readonly extensionUri: vscode.Uri
	/**
	 * The storage path for the extension.
	 */
	readonly storagePath?: string | undefined
	/**
	 * The global state of the extension.
	 */
	readonly globalState: vscode.Memento
	/**
	 * The workspace state of the extension.
	 */
	readonly workspaceState: vscode.Memento
	/**
	 * Logs a message at the 'log' level.
	 * @param message The message to log.
	 */
	log(message: string): void
	/**
	 * Logs an error message at the 'error' level.
	 * @param message The message to log.
	 */
	error(message: string): void
	/**
	 * Logs a warning message at the 'warn' level.
	 * @param message The message to log.
	 */
	warn(message: string): void
	/**
	 * Subscribe to a specific event.
	 * @param event The event to subscribe to.
	 * @param listener The callback function to be called when the event occurs.
	 */
	subscribe<T>(event: string, listener: (data: T) => void): vscode.Disposable
}

export interface IContextHolder {
	getContext(): vscode.ExtensionContext
}

/**
 * This class is a singleton that holds the vscode.ExtensionContext.
 * It can be obtained with ContextHolder.getInstance(context)
 *
 * Example of usage:
 * const contextHolder = ContextHolder.getInstance(context)
 * const extensionContext = contextHolder.getContext()
 *
 * OR
 * const contextHolder = ContextHolder.getInstanceWithoutArgs()
 * const extensionContext = contextHolder.getContext()
 */
export class ContextHolder implements IContextHolder {
	/**
	 * A singleton class that holds the vscode.ExtensionContext.
	 * It can be obtained with ContextHolder.getInstance(context)
	 *
	 * Example of usage:
	 * const contextHolder = ContextHolder.getInstance(context)
	 * const extensionContext = contextHolder.getContext()
	 */
	private static instance: ContextHolder | undefined
	private constructor(private readonly context: vscode.ExtensionContext) {}

	/**
	 * Gets the ContextHolder instance.
	 * @param context The vscode.ExtensionContext.
	 * @returns The ContextHolder instance.
	 */
	public static getInstance(context: vscode.ExtensionContext): ContextHolder {
		if (!ContextHolder.instance) {
			ContextHolder.instance = new ContextHolder(context)
		}
		return ContextHolder.instance
	}

	/**
	 * Gets the ContextHolder instance without passing the context.
	 * @returns The ContextHolder instance.
	 * @throws {Error} If the ContextHolder has not been initialized. Call getInstance() first.
	 */
	public static getInstanceWithoutArgs(): ContextHolder {
		if (!ContextHolder.instance) {
			throw new Error("ContextHolder has not been initialized. Call getInstance() first.")
		}
		return ContextHolder.instance
	}

	/**
	 * Gets the vscode.ExtensionContext.
	 * @returns The vscode.ExtensionContext.
	 */
	public getContext(): vscode.ExtensionContext {
		return this.context
	}
}
