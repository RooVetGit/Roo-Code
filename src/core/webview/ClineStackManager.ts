import { Cline } from "../Cline"

/**
 * Interface for managing the stack of Cline instances.
 * All methods are async for consistency and future extensibility.
 */
export interface IClineStackManager {
	/**
	 * Adds a new Cline instance to the stack
	 * @param cline The Cline instance to add
	 */
	addClineToStack(cline: Cline): Promise<void>

	/**
	 * Removes the top Cline instance from the stack and aborts its task
	 */
	removeClineFromStack(): Promise<void>

	/**
	 * Gets the current (top) Cline instance from the stack
	 * @returns The current Cline instance or undefined if the stack is empty
	 */
	getCurrentCline(): Promise<Cline | undefined>

	/**
	 * Gets the current size of the Cline stack
	 * @returns The number of Cline instances in the stack
	 */
	getClineStackSize(): Promise<number>

	/**
	 * Gets an array of task IDs from the Cline stack
	 * @returns Array of task IDs
	 */
	getCurrentTaskStack(): Promise<string[]>
}

/**
 * Manages a stack of Cline instances.
 * Provides methods to add, remove, and access Cline instances in the stack.
 */
export class ClineStackManager implements IClineStackManager {
	private clineStack: Cline[] = []

	/**
	 * Adds a new Cline instance to the stack
	 * @param cline The Cline instance to add
	 */
	async addClineToStack(cline: Cline): Promise<void> {
		this.clineStack.push(cline)
	}

	/**
	 * Removes the top Cline instance from the stack and aborts its task
	 */
	async removeClineFromStack(): Promise<void> {
		if (this.clineStack.length === 0) {
			return
		}

		const cline = this.clineStack.pop()

		if (cline) {
			try {
				// Abort the running task and set isAbandoned to true so
				// all running promises will exit as well.
				await cline.abortTask(true)
			} catch (e) {
				console.log(
					`[subtasks] encountered error while aborting task ${cline.taskId}.${cline.instanceId}: ${e.message}`,
				)
			}
		}
	}

	/**
	 * Gets the current (top) Cline instance from the stack
	 * @returns The current Cline instance or undefined if the stack is empty
	 */
	async getCurrentCline(): Promise<Cline | undefined> {
		if (this.clineStack.length === 0) {
			return undefined
		}
		return this.clineStack[this.clineStack.length - 1]
	}

	/**
	 * Gets the current size of the Cline stack
	 * @returns The number of Cline instances in the stack
	 */
	async getClineStackSize(): Promise<number> {
		return this.clineStack.length
	}

	/**
	 * Gets an array of task IDs from the Cline stack
	 * @returns Array of task IDs
	 */
	async getCurrentTaskStack(): Promise<string[]> {
		return this.clineStack.map((c) => c.taskId)
	}
}
