import fs from "fs"
import os from "os"
import path from "path"

/**
 * Interface for the followup question structure
 */
export interface FollowupQuestion {
	question: string
	suggest: string[]
	taskId: string
}

// Path to store the last followup question
const STORE_PATH = path.join(os.homedir(), ".roocli-followup.json")

/**
 * Store the last followup question
 * @param question The followup question to store
 */
export function storeFollowupQuestion(question: FollowupQuestion): void {
	try {
		fs.writeFileSync(STORE_PATH, JSON.stringify(question, null, 2))
	} catch (error) {
		console.error(`Error storing followup question: ${error}`)
	}
}

/**
 * Get the last stored followup question
 * @returns The last stored followup question or null if not found
 */
export function getLastFollowupQuestion(): FollowupQuestion | null {
	try {
		if (fs.existsSync(STORE_PATH)) {
			const data = fs.readFileSync(STORE_PATH, "utf8")
			return JSON.parse(data) as FollowupQuestion
		}
	} catch (error) {
		console.error(`Error reading followup question: ${error}`)
	}
	return null
}
