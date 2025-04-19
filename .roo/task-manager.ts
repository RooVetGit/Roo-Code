import * as fs from "fs/promises"
import * as path from "path"

interface TaskCheckpoint {
	id: string
	description: string
	component: string
	changes: string[]
	risks: string[]
	expected_feedback: string[]
	timestamp: string
}

interface TaskContext {
	task_id: string
	description: string
	created_at: string
	checkpoints: TaskCheckpoint[]
	test_results?: {
		unit_tests: {
			passing: number
			failing: number
			pending: number
		}
		linting: string
		manual_testing: string
	}
	current_state: {
		status: "in_progress" | "completed" | "failed"
		summary?: string
		final_commit?: {
			hash: string
			message: string
			changes: string[]
		}
	}
}

class TaskManager {
	private readonly iterationsDir = path.join(".roo", "iterations")

	constructor() {
		this.ensureIterationsDirectory()
	}

	private async ensureIterationsDirectory() {
		try {
			await fs.mkdir(this.iterationsDir, { recursive: true })
		} catch (error) {
			console.error("Failed to create iterations directory:", error)
		}
	}

	async createIteration(taskId: string, description: string): Promise<void> {
		const newTask: TaskContext = {
			task_id: taskId,
			description,
			created_at: new Date().toISOString(),
			checkpoints: [],
			current_state: {
				status: "in_progress",
			},
		}

		const logPath = this.getLogPath(taskId)
		await fs.writeFile(logPath, JSON.stringify(newTask, null, 2), "utf-8")
	}

	async addCheckpoint(taskId: string, checkpoint: TaskCheckpoint): Promise<void> {
		const logPath = this.getLogPath(taskId)
		const content = await fs.readFile(logPath, "utf-8")
		const task = JSON.parse(content) as TaskContext

		task.checkpoints.push(checkpoint)
		await fs.writeFile(logPath, JSON.stringify(task, null, 2), "utf-8")
	}

	async updateTestResults(taskId: string, results: TaskContext["test_results"]): Promise<void> {
		const logPath = this.getLogPath(taskId)
		const content = await fs.readFile(logPath, "utf-8")
		const task = JSON.parse(content) as TaskContext

		task.test_results = results
		await fs.writeFile(logPath, JSON.stringify(task, null, 2), "utf-8")
	}

	async completeIteration(taskId: string, commitInfo: TaskContext["current_state"]["final_commit"]): Promise<void> {
		const logPath = this.getLogPath(taskId)
		const content = await fs.readFile(logPath, "utf-8")
		const task = JSON.parse(content) as TaskContext

		task.current_state = {
			status: "completed",
			summary: `Successfully completed task with commit ${commitInfo.hash}`,
			final_commit: commitInfo,
		}

		await fs.writeFile(logPath, JSON.stringify(task, null, 2), "utf-8")
	}

	async getIteration(taskId: string): Promise<TaskContext | null> {
		try {
			const logPath = this.getLogPath(taskId)
			const content = await fs.readFile(logPath, "utf-8")
			return JSON.parse(content) as TaskContext
		} catch (error) {
			return null
		}
	}

	private getLogPath(taskId: string): string {
		return path.join(this.iterationsDir, `${taskId}.json`)
	}

	async listIterations(): Promise<string[]> {
		const files = await fs.readdir(this.iterationsDir)
		return files.filter((file) => file.endsWith(".json")).map((file) => file.replace(".json", ""))
	}
}

export const taskManager = new TaskManager()
