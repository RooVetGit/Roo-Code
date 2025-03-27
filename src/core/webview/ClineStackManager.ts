import { Cline } from "../Cline"

/**
 * Interface for managing a stack of Cline instances.
 * A stack is a data structure that uses Last-In-First-Out (LIFO) order to add and remove elements.
 * The top element of the stack is the one that is currently being shown to the user.
 */
export interface IClineStackManager {
	/**
	 * Adds a new Cline instance to the stack.
	 * The instance is pushed to the top of the stack (LIFO order).
	 * When the task is completed, the top instance is removed, reactivating the previous task.
	 * This is used when a task is created from the command palette.
	 */
	addClineToStack(cline: Cline): Promise<void>
	/**
	 * Removes the top Cline instance from the stack.
	 * Used when a task is completed from the command palette.
	 * The previous task is resumed.
	 */
	removeClineFromStack(): Promise<void>
	/**
	 * Returns the top Cline instance from the stack.
	 * If the stack is empty, returns undefined.
	 */
	getCurrentCline(): Promise<Cline | undefined>

	/**
	 * Returns the current clineStack length (how many cline objects are in the stack)
	 */
	getClineStackSize(): Promise<number>

	/**
	 * Returns the current clineStack (all cline objects in the stack)
	 */
	getCurrentTaskStack(): Promise<string[]>
}

/**
 * Manages a stack of Cline instances.
 * Cline instances are added to the stack and removed from the stack as the user
 * interacts with the extension.
 * The top Cline instance in the stack is the one that is currently being shown
 * to the user.
 */
export class ClineStackManager implements IClineStackManager {
	private clineStack: Cline[] = []

	constructor() {
		this.clineStack = []
	}

	/**
	 * Adds a new Cline instance to clineStack, marking the start of a new task.
	 * The instance is pushed to the top of the stack (LIFO order).
	 * When the task is completed, the top instance is removed, reactivating the previous task.
	 * This is used when a task is created from the command palette.
	 */
	async addClineToStack(cline: Cline): Promise<void> {
		this.clineStack.push(cline)
	}
	/**
	 * Adds a new Cline instance to clineStack, marking the start of a new task.
	 * The instance is pushed to the top of the stack (LIFO order).
	 * When the task is completed, the top instance is removed, reactivating the previous task.
	 * This is used when a task is created from the command palette.
	 */

	async getCurrentCline(): Promise<Cline | undefined> {
		if (this.clineStack.length === 0) {
			return undefined
		}
		return this.clineStack[this.clineStack.length - 1]
	}

	/**
	 * Removes and destroys the top Cline instance (the current finished task),
	 * activating the previous one (resuming the parent task).
	 * This is used when a task is completed from the command palette.
	 */
	async removeClineFromStack(): Promise<void> {
		if (this.clineStack.length === 0) {
			return
		}

		// Pop the top Cline instance from the stack.
		var cline = this.clineStack.pop()

		if (cline) {
			console.log(`[subtasks] removing task ${cline.taskId}.${cline.instanceId} from stack`)

			try {
				// Abort the running task and set isAbandoned to true so
				// all running promises will exit as well.
				await cline.abortTask(true)
			} catch (e) {
				console.log(
					`[subtasks] encountered error while aborting task ${cline.taskId}.${cline.instanceId}: ${e.message}`,
				)
			}

			// Make sure no reference kept, once promises end it will be
			// garbage collected.
			cline = undefined
		}
	}

	/**
	 * Returns the current clineStack length (how many cline objects are in the stack)
	 * todo: currently unused, to remove...
	 */
	async getClineStackSize(): Promise<number> {
		return this.clineStack.length
	}

	/**
	 * Returns the current clineStack (all cline objects in the stack)
	 */
	async getCurrentTaskStack(): Promise<string[]> {
		return this.clineStack.map((cline) => cline.taskId)
	}
}
// todo create a logger class to log to the output channel
// todo: process the cline.ts init properly in the clineStackManager.test.ts
