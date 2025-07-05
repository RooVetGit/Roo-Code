import * as vscode from "vscode"
import { ChildProcess } from "child_process"
import psTree from "ps-tree"

/**
 * Interface for tracking spawned processes
 */
export interface TrackedProcess {
	/** The child process instance */
	process: ChildProcess
	/** Unique identifier for the process */
	id: string
	/** Optional description of what this process is for */
	description?: string
	/** Debug session ID if this process is associated with a debug session */
	debugSessionId?: string
	/** Timestamp when the process was registered */
	registeredAt: number
}

/**
 * Central registry for tracking all spawned processes to ensure proper cleanup
 * during debug session termination and extension deactivation.
 */
export class ProcessRegistry implements vscode.Disposable {
	private processes = new Map<string, TrackedProcess>()
	private debugSessionProcesses = new Map<string, Set<string>>()
	private disposables: vscode.Disposable[] = []

	constructor() {
		// Register for debug session events to track process lifecycle
		// Only register if vscode.debug is available (not in test environment)
		try {
			if (vscode.debug && vscode.debug.onDidStartDebugSession) {
				this.disposables.push(
					vscode.debug.onDidStartDebugSession(this.onDebugSessionStart.bind(this)),
					vscode.debug.onDidTerminateDebugSession(this.onDebugSessionTerminate.bind(this)),
				)
			}
		} catch (error) {
			// Ignore errors in test environment where vscode.debug might not be available
		}
	}

	/**
	 * Register a process for tracking
	 */
	register(
		process: ChildProcess,
		id: string,
		options?: {
			description?: string
			debugSessionId?: string
		},
	): void {
		const trackedProcess: TrackedProcess = {
			process,
			id,
			description: options?.description,
			debugSessionId: options?.debugSessionId,
			registeredAt: Date.now(),
		}

		this.processes.set(id, trackedProcess)

		// Track debug session association
		if (options?.debugSessionId) {
			if (!this.debugSessionProcesses.has(options.debugSessionId)) {
				this.debugSessionProcesses.set(options.debugSessionId, new Set())
			}
			this.debugSessionProcesses.get(options.debugSessionId)!.add(id)
		}

		// Clean up when process exits naturally
		process.on("exit", () => {
			this.unregister(id)
		})
	}

	/**
	 * Unregister a process from tracking
	 */
	unregister(id: string): void {
		const trackedProcess = this.processes.get(id)
		if (trackedProcess) {
			// Remove from debug session tracking
			if (trackedProcess.debugSessionId) {
				const sessionProcesses = this.debugSessionProcesses.get(trackedProcess.debugSessionId)
				if (sessionProcesses) {
					sessionProcesses.delete(id)
					if (sessionProcesses.size === 0) {
						this.debugSessionProcesses.delete(trackedProcess.debugSessionId)
					}
				}
			}
			this.processes.delete(id)
		}
	}

	/**
	 * Kill a specific process and its children
	 */
	async killProcess(id: string, signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
		const trackedProcess = this.processes.get(id)
		if (!trackedProcess || !trackedProcess.process.pid) {
			return
		}

		try {
			await this.killProcessTree(trackedProcess.process.pid, signal)
		} catch (error) {
			console.warn(`Failed to kill process ${id}:`, error)
		} finally {
			this.unregister(id)
		}
	}

	/**
	 * Kill all processes associated with a debug session
	 */
	async killDebugSessionProcesses(debugSessionId: string): Promise<void> {
		const processIds = this.debugSessionProcesses.get(debugSessionId)
		if (!processIds) {
			return
		}

		const killPromises = Array.from(processIds).map((id) => this.killProcess(id))
		await Promise.allSettled(killPromises)
	}

	/**
	 * Kill all tracked processes
	 */
	async killAllProcesses(): Promise<void> {
		const killPromises = Array.from(this.processes.keys()).map((id) => this.killProcess(id))
		await Promise.allSettled(killPromises)
	}

	/**
	 * Get information about all tracked processes
	 */
	getTrackedProcesses(): TrackedProcess[] {
		return Array.from(this.processes.values())
	}

	/**
	 * Get processes associated with a specific debug session
	 */
	getDebugSessionProcesses(debugSessionId: string): TrackedProcess[] {
		const processIds = this.debugSessionProcesses.get(debugSessionId)
		if (!processIds) {
			return []
		}

		return Array.from(processIds)
			.map((id) => this.processes.get(id))
			.filter((process): process is TrackedProcess => process !== undefined)
	}

	private onDebugSessionStart(session: vscode.DebugSession): void {
		// Debug session started - we'll track processes as they're spawned
		console.log(`Debug session started: ${session.id}`)
	}

	private async onDebugSessionTerminate(session: vscode.DebugSession): Promise<void> {
		// Debug session terminated - clean up all associated processes
		console.log(`Debug session terminated: ${session.id}, cleaning up processes`)
		await this.killDebugSessionProcesses(session.id)
	}

	/**
	 * Kill a process tree using ps-tree with timeout-based escalation
	 */
	private async killProcessTree(pid: number, signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
		return new Promise((resolve) => {
			// First, try to get the process tree
			psTree(pid, (err, children) => {
				if (err) {
					// Process might already be dead
					resolve()
					return
				}

				// Kill all child processes first
				const childPids = children.map((p) => parseInt(p.PID))
				childPids.forEach((childPid) => {
					try {
						process.kill(childPid, signal)
					} catch (error) {
						// Process might already be dead
					}
				})

				// Kill the main process
				try {
					process.kill(pid, signal)
				} catch (error) {
					// Process might already be dead
				}

				// If using SIGTERM, set up escalation to SIGKILL after timeout
				if (signal === "SIGTERM") {
					setTimeout(() => {
						// Escalate to SIGKILL if process is still alive
						try {
							process.kill(pid, "SIGKILL")
							childPids.forEach((childPid) => {
								try {
									process.kill(childPid, "SIGKILL")
								} catch (error) {
									// Process might already be dead
								}
							})
						} catch (error) {
							// Process is already dead
						}
						resolve()
					}, 5000) // 5 second timeout before escalating to SIGKILL
				} else {
					resolve()
				}
			})
		})
	}

	dispose(): void {
		// Clean up all processes and event listeners
		this.killAllProcesses().catch((error) => {
			console.warn("Error during ProcessRegistry disposal:", error)
		})

		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []
		this.processes.clear()
		this.debugSessionProcesses.clear()
	}
}

// Global instance for the extension
export const processRegistry = new ProcessRegistry()
