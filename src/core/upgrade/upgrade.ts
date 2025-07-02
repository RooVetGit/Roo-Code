import { isTaskHistoryMigrationNeeded, migrateTaskHistoryStorage } from "../task-persistence/taskHistory"

/**
 * Checks if any upgrades are needed in the system.
 * Currently checks for task history migration needs.
 *
 * @returns A promise that resolves to true if any upgrades are needed, false otherwise.
 */
export async function isUpgradeNeeded(): Promise<boolean> {
	// Check if task history migration is needed
	const taskHistoryMigrationNeeded = await isTaskHistoryMigrationNeeded()

	// Return true if any upgrade is needed
	return taskHistoryMigrationNeeded
}

/**
 * Performs all necessary upgrades in the system.
 * Currently handles task history migration.
 *
 * @param logs Optional array to capture log messages
 * @returns A promise that resolves to true if upgrades were performed, false if no upgrades were needed.
 */
export async function performUpgrade(logs: string[] = []): Promise<boolean> {
	// Check if task history migration is needed
	const taskHistoryMigrationNeeded = await isTaskHistoryMigrationNeeded()

	// Perform task history migration if needed
	if (taskHistoryMigrationNeeded) {
		await migrateTaskHistoryStorage(logs)
		return true
	}

	// No upgrades were needed
	return false
}
