import * as path from "path"
import * as os from "os"
import { PersistentUsageItem, PersistentUsageItemSchema, UsageSummary, HistoryItem } from "@roo-code/types"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../utils/fs"
import * as fs from "fs/promises"

/**
 * Service for managing persistent usage tracking data
 * Stores data in ~/.roo/usage-tracking.json
 */
export class UsageTrackingService {
	private static instance: UsageTrackingService | null = null
	private readonly filePath: string

	private constructor() {
		// Store in global ~/.roo directory
		const rooDir = path.join(os.homedir(), ".roo")
		this.filePath = path.join(rooDir, "usage-tracking.json")
	}

	public static getInstance(): UsageTrackingService {
		if (!UsageTrackingService.instance) {
			UsageTrackingService.instance = new UsageTrackingService()
		}
		return UsageTrackingService.instance
	}

	/**
	 * Load existing usage data from disk
	 */
	private async loadData(): Promise<PersistentUsageItem[]> {
		try {
			if (!(await fileExistsAtPath(this.filePath))) {
				return []
			}

			const content = await fs.readFile(this.filePath, "utf-8")
			const data = JSON.parse(content)

			// Validate and parse each item
			if (Array.isArray(data)) {
				return data
					.map((item) => {
						try {
							return PersistentUsageItemSchema.parse(item)
						} catch {
							// Skip invalid items
							return null
						}
					})
					.filter((item): item is PersistentUsageItem => item !== null)
			}

			return []
		} catch (error) {
			console.error("Failed to load usage tracking data:", error)
			return []
		}
	}

	/**
	 * Save usage data to disk
	 */
	private async saveData(data: PersistentUsageItem[]): Promise<void> {
		try {
			await safeWriteJson(this.filePath, data)
		} catch (error) {
			console.error("Failed to save usage tracking data:", error)
			throw error
		}
	}

	/**
	 * Update usage tracking with new task data
	 */
	public async updateUsageTracking(historyItem: HistoryItem, workspacePath: string): Promise<void> {
		try {
			const data = await this.loadData()

			// Remove existing entry for this task if it exists
			const filteredData = data.filter((item) => item.taskId !== historyItem.id)

			// Calculate total cost and tokens from the history item
			let totalCost = 0
			let totalInputTokens = 0
			let totalOutputTokens = 0
			let totalCacheReads = 0
			let totalCacheWrites = 0

			// Sum up all API request info from the task
			if (historyItem.totalCost) {
				totalCost = historyItem.totalCost
			}
			if (historyItem.tokensIn) {
				totalInputTokens = historyItem.tokensIn
			}
			if (historyItem.tokensOut) {
				totalOutputTokens = historyItem.tokensOut
			}
			if (historyItem.cacheReads) {
				totalCacheReads = historyItem.cacheReads
			}
			if (historyItem.cacheWrites) {
				totalCacheWrites = historyItem.cacheWrites
			}

			// Add new usage item
			const newItem: PersistentUsageItem = {
				taskId: historyItem.id,
				taskWorkspace: workspacePath,
				mode: historyItem.mode,
				timestamp: historyItem.ts,
				cost: totalCost,
				inputTokens: totalInputTokens,
				outputTokens: totalOutputTokens,
				cacheReads: totalCacheReads,
				cacheWrites: totalCacheWrites,
			}

			filteredData.push(newItem)

			// Save updated data
			await this.saveData(filteredData)
		} catch (error) {
			console.error("Failed to update usage tracking:", error)
			// Don't throw - we don't want to break the main flow
		}
	}

	/**
	 * Get usage summary for display
	 */
	public async getUsageSummary(workspacePath?: string): Promise<UsageSummary> {
		try {
			const data = await this.loadData()

			// Filter by workspace if specified
			const filteredData = workspacePath ? data.filter((item) => item.taskWorkspace === workspacePath) : data

			// Calculate totals
			let totalCost = 0
			let totalInputTokens = 0
			let totalOutputTokens = 0
			let totalCacheReads = 0
			let totalCacheWrites = 0
			const modeBreakdown: UsageSummary["modeBreakdown"] = {}

			for (const item of filteredData) {
				totalCost += item.cost
				totalInputTokens += item.inputTokens
				totalOutputTokens += item.outputTokens
				totalCacheReads += item.cacheReads
				totalCacheWrites += item.cacheWrites

				// Update mode breakdown
				const mode = item.mode || "unknown"
				if (!modeBreakdown[mode]) {
					modeBreakdown[mode] = {
						cost: 0,
						inputTokens: 0,
						outputTokens: 0,
						cacheReads: 0,
						cacheWrites: 0,
						count: 0,
					}
				}

				modeBreakdown[mode].cost += item.cost
				modeBreakdown[mode].inputTokens += item.inputTokens
				modeBreakdown[mode].outputTokens += item.outputTokens
				modeBreakdown[mode].cacheReads += item.cacheReads
				modeBreakdown[mode].cacheWrites += item.cacheWrites
				modeBreakdown[mode].count += 1
			}

			// Get workspace name from path
			const workspaceName = workspacePath ? path.basename(workspacePath) : undefined

			return {
				totalCost,
				totalInputTokens,
				totalOutputTokens,
				totalCacheReads,
				totalCacheWrites,
				modeBreakdown,
				workspaceName,
			}
		} catch (error) {
			console.error("Failed to get usage summary:", error)
			// Return empty summary on error
			return {
				totalCost: 0,
				totalInputTokens: 0,
				totalOutputTokens: 0,
				totalCacheReads: 0,
				totalCacheWrites: 0,
				modeBreakdown: {},
			}
		}
	}

	/**
	 * Migrate existing task history to persistent storage
	 */
	public async migrateFromTaskHistory(taskHistory: HistoryItem[], workspacePath: string): Promise<void> {
		try {
			const data = await this.loadData()
			const existingTaskIds = new Set(data.map((item) => item.taskId))

			// Only migrate tasks that aren't already in persistent storage
			const tasksToMigrate = taskHistory.filter((task) => !existingTaskIds.has(task.id))

			for (const task of tasksToMigrate) {
				if (task.totalCost || task.tokensIn || task.tokensOut) {
					await this.updateUsageTracking(task, workspacePath)
				}
			}
		} catch (error) {
			console.error("Failed to migrate task history:", error)
		}
	}

	/**
	 * Clear all usage data (for testing or reset)
	 */
	public async clearAllData(): Promise<void> {
		try {
			await this.saveData([])
		} catch (error) {
			console.error("Failed to clear usage data:", error)
		}
	}

	/**
	 * Remove usage data for a specific task
	 */
	public async removeTask(taskId: string): Promise<void> {
		try {
			const data = await this.loadData()
			const filteredData = data.filter((item) => item.taskId !== taskId)
			await this.saveData(filteredData)
		} catch (error) {
			console.error("Failed to remove task from usage tracking:", error)
		}
	}
}

// Export singleton instance getter
export const getUsageTrackingService = () => UsageTrackingService.getInstance()
