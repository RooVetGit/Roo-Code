import { spawn, ChildProcess } from "child_process"
import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs/promises"

interface CursorInstance {
	process: ChildProcess
	projectDir: string
	prompt: string
	mode?: string
}

// Track active cursor instances
const activeCursorInstances: Map<string, CursorInstance> = new Map()

/**
 * Gets the path to the Cursor application
 * @returns Promise<{command: string, args: string[]}> Command and args to launch Cursor
 */
async function getCursorLaunchCommand(projectDir: string): Promise<{ command: string; args: string[] }> {
	// Use code command with Cursor profile
	return {
		command: "cursor",
		args: ["--new-window", projectDir],
	}
}

/**
 * Opens a new instance of Cursor at a specific project directory
 * @param prompt The initial prompt to send to Roo Code
 * @param mode Optional mode to start in (code, ask, architect)
 * @param projectDir The directory to open Cursor in
 * @returns Promise<string> Instance ID if successful
 */
export async function openCursorInstance(prompt: string, mode: string = "code", projectDir: string): Promise<string> {
	try {
		// Ensure project directory exists
		const normalizedPath = path.normalize(projectDir)
		await fs.access(normalizedPath)

		// Generate unique instance ID
		const instanceId = `cursor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

		// Get platform-specific launch command
		const { command, args } = await getCursorLaunchCommand(normalizedPath)

		// Spawn process with inherited stdio
		const cursorProcess = spawn(command, args, {
			detached: false,
			stdio: "inherit",
		})

		// Handle process error
		cursorProcess.on("error", (error) => {
			console.error(`Error launching Cursor instance ${instanceId}:`, error)
			activeCursorInstances.delete(instanceId)
			throw error
		})

		// Store instance information
		const instance: CursorInstance = {
			process: cursorProcess,
			projectDir: normalizedPath,
			prompt,
			mode,
		}

		activeCursorInstances.set(instanceId, instance)

		console.log(instance)
		cursorProcess.stdin?.write(prompt)

		// Show information message
		vscode.window.showInformationMessage(`New Cursor instance opened at ${normalizedPath}`)

		return instanceId
	} catch (error) {
		console.error("Failed to open Cursor instance:", error)
		if (error instanceof Error) {
			vscode.window.showErrorMessage(`Failed to open Cursor: ${error.message}`)
		}
		throw error
	}
}

/**
 * Get all active cursor instances
 * @returns Map of active cursor instances
 */
export function getActiveCursorInstances(): Map<string, CursorInstance> {
	return new Map(activeCursorInstances)
}

/**
 * Close a specific cursor instance
 * @param instanceId The ID of the instance to close
 * @returns boolean indicating if the instance was successfully closed
 */
export function closeCursorInstance(instanceId: string): boolean {
	const instance = activeCursorInstances.get(instanceId)
	if (!instance) {
		return false
	}

	try {
		instance.process.kill()
		activeCursorInstances.delete(instanceId)
		return true
	} catch (error) {
		console.error(`Error closing Cursor instance ${instanceId}:`, error)
		return false
	}
}

/**
 * Close all active cursor instances
 */
export function closeAllCursorInstances(): void {
	for (const [instanceId] of activeCursorInstances) {
		closeCursorInstance(instanceId)
	}
}

/**
 * Send a command to the Roo Code extension in a specific Cursor instance
 * @param instanceId The ID of the Cursor instance to send the command to
 * @param command The Roo Code command to execute (e.g., 'startNewTask')
 * @param args Optional arguments for the command
 * @returns Promise<void>
 */
export async function sendRooCodeCommand(instanceId: string, command: string, args?: any): Promise<void> {
	const instance = activeCursorInstances.get(instanceId)
	if (!instance) {
		throw new Error(`No active Cursor instance found with ID: ${instanceId}`)
	}

	try {
		// Wait for Cursor to be ready
		await new Promise((resolve) => setTimeout(resolve, 2000))

		// Focus the window first
		await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(instance.projectDir), true)
		await new Promise((resolve) => setTimeout(resolve, 1000))

		// Send the command
		await vscode.commands.executeCommand(command, args)

		// Log command for debugging
		console.log(`Executed command in Cursor instance ${instanceId}:`, command, args)
	} catch (error) {
		console.error(`Failed to send command to Cursor instance ${instanceId}:`, error)
		throw error
	}
}

/**
 * Start a new Roo Code task in a specific Cursor instance
 * @param instanceId The ID of the Cursor instance
 * @param prompt The prompt for the new task
 * @param mode Optional mode to start in (code, ask, architect)
 * @returns Promise<void>
 */
export async function startRooCodeTask(instanceId: string, prompt: string, mode: string = "code"): Promise<void> {
	await sendRooCodeCommand(instanceId, "roo-cline.startTask", {
		prompt,
		mode,
		projectDir: activeCursorInstances.get(instanceId)?.projectDir,
	})
}
