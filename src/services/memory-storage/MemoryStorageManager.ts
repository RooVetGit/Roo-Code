import { CodeIndexConfigManager } from "../code-index/config-manager"
import { CodeIndexServiceFactory } from "../code-index/service-factory"
import { MemoryStorageService } from "./MemoryStorageService"

/**
 * Singleton manager for the memory storage service.
 * Ensures a single instance is shared across the application.
 */
export class MemoryStorageManager {
	private static instance: MemoryStorageManager | null = null
	private memoryStorageService: MemoryStorageService | null = null

	private constructor(
		private configManager: CodeIndexConfigManager,
		private serviceFactory: CodeIndexServiceFactory,
		private workspacePath: string,
	) {}

	/**
	 * Get or create the singleton instance
	 */
	static getInstance(
		configManager: CodeIndexConfigManager,
		serviceFactory: CodeIndexServiceFactory,
		workspacePath: string,
	): MemoryStorageManager {
		if (!MemoryStorageManager.instance) {
			MemoryStorageManager.instance = new MemoryStorageManager(configManager, serviceFactory, workspacePath)
		}
		return MemoryStorageManager.instance
	}

	/**
	 * Get the memory storage service, creating it if necessary
	 */
	async getMemoryStorageService(): Promise<MemoryStorageService | null> {
		if (!this.configManager.isMemoryStorageEnabled) {
			return null
		}

		if (!this.memoryStorageService) {
			this.memoryStorageService = new MemoryStorageService(
				this.configManager,
				this.serviceFactory,
				this.workspacePath,
			)
			await this.memoryStorageService.initialize()
		}

		return this.memoryStorageService
	}

	/**
	 * Check if memory storage is enabled
	 */
	isEnabled(): boolean {
		return this.configManager.isMemoryStorageEnabled
	}

	/**
	 * Reset the singleton instance (mainly for testing)
	 */
	static reset(): void {
		if (MemoryStorageManager.instance?.memoryStorageService) {
			MemoryStorageManager.instance.memoryStorageService.dispose()
		}
		MemoryStorageManager.instance = null
	}
}
