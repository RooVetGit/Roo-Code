import * as vscode from "vscode"
import WorkspaceTracker from "../../integrations/workspace/WorkspaceTracker"
import { McpHub } from "../../services/mcp/McpHub"
import { McpServerManager } from "../../services/mcp/McpServerManager"
import { CustomModesManager } from "../config/CustomModesManager"
import { ClineProvider } from "./ClineProvider"

/**
 * Manages the lifecycle and access to core components used by ClineProvider:
 * - WorkspaceTracker: Tracks workspace file changes and open tabs
 * - McpHub: Manages MCP server connections and communication
 * - CustomModesManager: Handles custom mode configurations
 */
export class ComponentManager {
	private _workspaceTracker?: WorkspaceTracker
	private _mcpHub?: McpHub
	private _customModesManager: CustomModesManager
	private _isDisposed = false

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly provider: ClineProvider,
	) {
		// Initialize WorkspaceTracker
		this._workspaceTracker = new WorkspaceTracker(this.provider)

		// Initialize CustomModesManager (always available)
		this._customModesManager = new CustomModesManager(this.context, async () => {
			await this.provider.postStateToWebview()
		})

		// Initialize MCP Hub through the singleton manager
		this.initializeMcpHub()
	}

	/**
	 * Initializes the MCP Hub
	 */
	private initializeMcpHub(): void {
		McpServerManager.getInstance(this.context, this.provider)
			.then((hub) => {
				this._mcpHub = hub
				this._mcpHub.registerClient()
			})
			.catch((error) => {
				console.error(`Failed to initialize MCP Hub: ${error}`)
			})
	}

	/**
	 * Gets the WorkspaceTracker instance
	 */
	get workspaceTracker(): WorkspaceTracker | undefined {
		return this._workspaceTracker
	}

	/**
	 * Gets the McpHub instance
	 */
	get mcpHub(): McpHub | undefined {
		return this._mcpHub
	}

	/**
	 * Gets the CustomModesManager instance
	 */
	get customModesManager(): CustomModesManager {
		return this._customModesManager
	}

	/**
	 * Checks if the ComponentManager is disposed
	 */
	get isDisposed(): boolean {
		return this._isDisposed
	}

	/**
	 * Disposes all managed components and cleans up resources
	 */
	async dispose(): Promise<void> {
		if (this._isDisposed) {
			return
		}

		this._isDisposed = true

		// Dispose WorkspaceTracker
		if (this._workspaceTracker) {
			this._workspaceTracker.dispose()
			this._workspaceTracker = undefined
		}

		// Dispose CustomModesManager
		this._customModesManager.dispose()

		// Dispose MCP Hub
		if (this._mcpHub) {
			await this._mcpHub.unregisterClient()
			this._mcpHub = undefined
		}

		// Unregister from McpServerManager
		McpServerManager.unregisterProvider(this.provider)
	}
}
