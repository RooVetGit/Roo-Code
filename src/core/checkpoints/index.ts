import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import { TelemetryService } from "@roo-code/telemetry"
import { FileChangeType } from "@roo-code/types"

import { Task } from "../task/Task"

import { getWorkspacePath } from "../../utils/path"

import { ClineApiReqInfo } from "../../shared/ExtensionMessage"
import { getApiMetrics } from "../../shared/getApiMetrics"

import { DIFF_VIEW_URI_SCHEME } from "../../integrations/editor/DiffViewProvider"

import { CheckpointServiceOptions, RepoPerTaskCheckpointService } from "../../services/checkpoints"
import { FileChangeManager } from "../../services/file-changes/FileChangeManager"
import { CheckpointResult } from "../../services/checkpoints/types"

export function getCheckpointService(cline: Task) {
	if (cline.checkpointService) {
		return cline.checkpointService
	}
	console.log(
		`[DEBUG] getCheckpointService called for task ${cline.taskId}. Service exists: ${!!cline.checkpointService}`,
	)
	if (!cline.enableCheckpoints) {
		return undefined
	}

	if (cline.checkpointServiceInitializing) {
		console.log("[Task#getCheckpointService] checkpoint service is still initializing")
		return undefined
	}

	const provider = cline.providerRef.deref()

	const log = (message: string) => {
		console.log(message)

		try {
			provider?.log(message)
		} catch (err) {
			// NO-OP
		}
	}

	console.log("[Task#getCheckpointService] initializing checkpoints service")

	try {
		const workspaceDir = getWorkspacePath()

		if (!workspaceDir) {
			log("[Task#getCheckpointService] workspace folder not found, disabling checkpoints")
			cline.enableCheckpoints = false
			return undefined
		}

		const globalStorageDir = provider?.context.globalStorageUri.fsPath

		if (!globalStorageDir) {
			log("[Task#getCheckpointService] globalStorageDir not found, disabling checkpoints")
			cline.enableCheckpoints = false
			return undefined
		}

		const options: CheckpointServiceOptions = {
			taskId: cline.taskId,
			workspaceDir,
			shadowDir: globalStorageDir,
			log,
		}

		const service = RepoPerTaskCheckpointService.create(options)

		cline.checkpointServiceInitializing = true

		service.on("initialize", async () => {
			log("[Task#getCheckpointService] service initialized")

			try {
				// Debug logging to understand checkpoint detection
				console.log("[DEBUG] Checkpoint detection - total messages:", cline.clineMessages.length)
				console.log(
					"[DEBUG] Checkpoint detection - message types:",
					cline.clineMessages.map((m) => ({ ts: m.ts, type: m.type, say: m.say, ask: m.ask })),
				)

				const checkpointMessages = cline.clineMessages.filter(({ say }) => say === "checkpoint_saved")
				console.log(
					"[DEBUG] Found checkpoint messages:",
					checkpointMessages.length,
					checkpointMessages.map((m) => ({ ts: m.ts, text: m.text })),
				)

				const isCheckpointNeeded = checkpointMessages.length === 0
				console.log("[DEBUG] isCheckpointNeeded result:", isCheckpointNeeded)

				cline.checkpointService = service
				cline.checkpointServiceInitializing = false

				// Update FileChangeManager baseline to match checkpoint service
				try {
					const fileChangeManager = provider?.getFileChangeManager()
					if (fileChangeManager) {
						const currentBaseline = fileChangeManager.getChanges().baseCheckpoint
						if (currentBaseline === "HEAD") {
							if (isCheckpointNeeded) {
								// New task: set baseline to initial checkpoint
								if (service.baseHash && service.baseHash !== "HEAD") {
									await fileChangeManager.updateBaseline(service.baseHash)
									log(
										`[Task#getCheckpointService] New task: Updated FileChangeManager baseline from HEAD to ${service.baseHash}`,
									)
								}
							} else {
								// Existing task: set baseline to current checkpoint (HEAD of checkpoint history)
								const currentCheckpoint = service.getCurrentCheckpoint()
								if (currentCheckpoint && currentCheckpoint !== "HEAD") {
									await fileChangeManager.updateBaseline(currentCheckpoint)
									log(
										`[Task#getCheckpointService] Existing task: Updated FileChangeManager baseline from HEAD to current checkpoint ${currentCheckpoint}`,
									)
								}
							}
						}
					}
				} catch (error) {
					log(`[Task#getCheckpointService] Failed to update FileChangeManager baseline: ${error}`)
					// Don't throw - allow checkpoint service to continue initializing
				}

				if (isCheckpointNeeded) {
					log("[Task#getCheckpointService] no checkpoints found, saving initial checkpoint")
					checkpointSave(cline, true)
				} else {
					log("[Task#getCheckpointService] existing checkpoints found, skipping initial checkpoint")
				}
			} catch (err) {
				log("[Task#getCheckpointService] caught error in on('initialize'), disabling checkpoints")
				cline.enableCheckpoints = false
			}
		})

		service.on("checkpointCreated", async ({ isFirst, fromHash, toHash }) => {
			try {
				provider?.postMessageToWebview({ type: "currentCheckpointUpdated", text: toHash })

				await cline.say(
					"checkpoint_saved",
					toHash,
					undefined,
					undefined,
					{ isFirst, from: fromHash, to: toHash },
					undefined,
					{ isNonInteractive: true },
				)

				// Calculate changes using checkpoint service directly
				try {
					const checkpointFileChangeManager = provider?.getFileChangeManager()
					if (checkpointFileChangeManager) {
						// Get the initial baseline (preserve for cumulative diff tracking)
						const initialBaseline = checkpointFileChangeManager.getChanges().baseCheckpoint
						log(
							`[Task#checkpointCreated] Calculating cumulative changes from initial baseline ${initialBaseline} to ${toHash}`,
						)

						// Calculate cumulative diff from initial baseline to new checkpoint using checkpoint service
						const changes = await service.getDiff({ from: initialBaseline, to: toHash })

						if (changes && changes.length > 0) {
							// Convert to FileChange format with correct checkpoint references
							const fileChanges = changes.map((change: any) => ({
								uri: change.paths.relative,
								type: (change.paths.newFile
									? "create"
									: change.paths.deletedFile
										? "delete"
										: "edit") as FileChangeType,
								fromCheckpoint: initialBaseline, // Always reference initial baseline for cumulative view
								toCheckpoint: toHash, // Current checkpoint for comparison
								linesAdded: change.content.after ? change.content.after.split("\n").length : 0,
								linesRemoved: change.content.before ? change.content.before.split("\n").length : 0,
							}))

							log(`[Task#checkpointCreated] Found ${fileChanges.length} cumulative file changes`)

							// Update FileChangeManager with the new files so view diff can find them
							checkpointFileChangeManager.setFiles(fileChanges)

							// DON'T clear accepted/rejected state here - preserve user's accept/reject decisions
							// The state should only be cleared on baseline changes (checkpoint restore) or task restart

							// Get filtered changeset that excludes already accepted/rejected files and only shows LLM-modified files
							const filteredChangeset = await checkpointFileChangeManager.getLLMOnlyChanges(
								cline.taskId,
								cline.fileContextTracker,
							)

							// Create changeset and send to webview (only LLM-modified, unaccepted files)
							const serializableChangeset = {
								baseCheckpoint: filteredChangeset.baseCheckpoint,
								files: filteredChangeset.files,
							}

							log(
								`[Task#checkpointCreated] Sending ${filteredChangeset.files.length} LLM-only file changes to webview`,
							)

							provider?.postMessageToWebview({
								type: "filesChanged",
								filesChanged: serializableChangeset,
							})
						} else {
							log(`[Task#checkpointCreated] No changes found between ${initialBaseline} and ${toHash}`)
						}

						// DON'T update the baseline - keep it at initial baseline for cumulative tracking
						// The baseline should only change when explicitly requested (e.g., checkpoint restore)
						log(
							`[Task#checkpointCreated] Keeping FileChangeManager baseline at ${initialBaseline} for cumulative tracking`,
						)
					}
				} catch (error) {
					log(`[Task#checkpointCreated] Error calculating/sending file changes: ${error}`)
				}
			} catch (err) {
				log(
					"[Task#getCheckpointService] caught unexpected error in on('checkpointCreated'), disabling checkpoints",
				)
				console.error(err)
				cline.enableCheckpoints = false
			}
		})

		log("[Task#getCheckpointService] initializing shadow git")

		service.initShadowGit().catch((err) => {
			log(`[Task#getCheckpointService] initShadowGit -> ${err.message}`)
			cline.enableCheckpoints = false
		})

		return service
	} catch (err) {
		log(`[Task#getCheckpointService] ${err.message}`)
		cline.enableCheckpoints = false
		return undefined
	}
}

export async function getInitializedCheckpointService(
	cline: Task,
	{ interval = 250, timeout = 15_000 }: { interval?: number; timeout?: number } = {},
) {
	const service = getCheckpointService(cline)

	if (!service || service.isInitialized) {
		return service
	}

	try {
		await pWaitFor(
			() => {
				console.log("[Task#getCheckpointService] waiting for service to initialize")
				return service.isInitialized
			},
			{ interval, timeout },
		)

		return service
	} catch (err) {
		return undefined
	}
}

// Track ongoing checkpoint saves per task to prevent duplicates
const ongoingCheckpointSaves = new Map<string, Promise<void | CheckpointResult | undefined>>()

export async function checkpointSave(cline: Task, force = false, files?: vscode.Uri[]) {
	// Create a unique key for this checkpoint save operation
	const filesKey = files
		? files
				.map((f) => f.fsPath)
				.sort()
				.join("|")
		: "all"
	const saveKey = `${cline.taskId}-${force}-${filesKey}`

	// If there's already an ongoing checkpoint save for this exact operation, return the existing promise
	if (ongoingCheckpointSaves.has(saveKey)) {
		const provider = cline.providerRef.deref()
		provider?.log(`[checkpointSave] duplicate checkpoint save detected for ${saveKey}, using existing operation`)
		return ongoingCheckpointSaves.get(saveKey)
	}
	const service = getCheckpointService(cline)

	if (!service) {
		return
	}

	if (!service.isInitialized) {
		const provider = cline.providerRef.deref()
		provider?.log("[checkpointSave] checkpoints didn't initialize in time, disabling checkpoints for this task")
		cline.enableCheckpoints = false
		return
	}

	TelemetryService.instance.captureCheckpointCreated(cline.taskId)

	// Get provider for messaging
	const provider = cline.providerRef.deref()

	// Capture the previous checkpoint BEFORE saving the new one
	const previousCheckpoint = service.getCurrentCheckpoint()
	console.log(`[checkpointSave] Previous checkpoint: ${previousCheckpoint}`)

	// Start the checkpoint process in the background and track it
	const savePromise = service
		.saveCheckpoint(`Task: ${cline.taskId}, Time: ${Date.now()}`, { allowEmpty: force, files })
		.then(async (result: any) => {
			console.log(`[checkpointSave] New checkpoint created: ${result.commit}`)

			// Notify FCO that checkpoint was created
			if (provider && result) {
				try {
					provider.postMessageToWebview({
						type: "checkpoint_created",
						checkpoint: result.commit,
						previousCheckpoint: previousCheckpoint,
					} as any)

					// NOTE: Don't send filesChanged here - it's handled by the checkpointCreated event
					// to avoid duplicate/conflicting messages that override cumulative tracking.
					// The checkpointCreated event handler calculates cumulative changes from the baseline
					// and sends the complete filesChanged message with all accumulated changes.
					console.log(
						`[checkpointSave] FCO update delegated to checkpointCreated event for cumulative tracking`,
					)
				} catch (error) {
					console.error("[Task#checkpointSave] Failed to notify FCO of checkpoint creation:", error)
				}
			}
			return result
		})
		.catch((err: any) => {
			console.error("[Task#checkpointSave] caught unexpected error, disabling checkpoints", err)
			cline.enableCheckpoints = false
		})
		.finally(() => {
			// Clean up the tracking once completed
			ongoingCheckpointSaves.delete(saveKey)
		})

	ongoingCheckpointSaves.set(saveKey, savePromise)
	return savePromise
}

export type CheckpointRestoreOptions = {
	ts: number
	commitHash: string
	mode: "preview" | "restore"
}

export async function checkpointRestore(cline: Task, { ts, commitHash, mode }: CheckpointRestoreOptions) {
	const service = await getInitializedCheckpointService(cline)

	if (!service) {
		return
	}

	const index = cline.clineMessages.findIndex((m) => m.ts === ts)

	if (index === -1) {
		return
	}

	const provider = cline.providerRef.deref()

	try {
		await service.restoreCheckpoint(commitHash)
		TelemetryService.instance.captureCheckpointRestored(cline.taskId)
		await provider?.postMessageToWebview({ type: "currentCheckpointUpdated", text: commitHash })

		// Update FileChangeManager baseline to restored checkpoint and clear accept/reject state
		try {
			const fileChangeManager = provider?.getFileChangeManager()
			if (fileChangeManager) {
				// Reset baseline to restored checkpoint (fresh start from this point)
				await fileChangeManager.updateBaseline(commitHash)
				provider?.log(
					`[checkpointRestore] Reset FileChangeManager baseline to restored checkpoint ${commitHash}`,
				)

				// Clear accept/reject state - checkpoint restore is time travel, start with clean slate
				if (typeof fileChangeManager.clearAcceptedRejectedState === "function") {
					fileChangeManager.clearAcceptedRejectedState()
					provider?.log(`[checkpointRestore] Cleared accept/reject state for fresh start`)
				}

				// Calculate and send current changes (should be empty immediately after restore)
				const changes = fileChangeManager.getChanges()
				provider?.postMessageToWebview({
					type: "filesChanged",
					filesChanged: changes.files.length > 0 ? changes : undefined,
				})
			}
		} catch (error) {
			provider?.log(`[checkpointRestore] Failed to update FileChangeManager baseline: ${error}`)
			// Don't throw - allow restore to continue even if FCO sync fails
		}

		// Notify FCO that checkpoint was restored
		try {
			await provider?.postMessageToWebview({
				type: "checkpoint_restored",
				checkpoint: commitHash,
			} as any)
		} catch (error) {
			console.error("[checkpointRestore] Failed to notify FCO of checkpoint restore:", error)
		}

		if (mode === "restore") {
			await cline.overwriteApiConversationHistory(cline.apiConversationHistory.filter((m) => !m.ts || m.ts < ts))

			const deletedMessages = cline.clineMessages.slice(index + 1)

			const { totalTokensIn, totalTokensOut, totalCacheWrites, totalCacheReads, totalCost } = getApiMetrics(
				cline.combineMessages(deletedMessages),
			)

			await cline.overwriteClineMessages(cline.clineMessages.slice(0, index + 1))

			// TODO: Verify that this is working as expected.
			await cline.say(
				"api_req_deleted",
				JSON.stringify({
					tokensIn: totalTokensIn,
					tokensOut: totalTokensOut,
					cacheWrites: totalCacheWrites,
					cacheReads: totalCacheReads,
					cost: totalCost,
				} satisfies ClineApiReqInfo),
			)
		}

		// The task is already cancelled by the provider beforehand, but we
		// need to re-init to get the updated messages.
		//
		// This was take from Cline's implementation of the checkpoints
		// feature. The cline instance will hang if we don't cancel twice,
		// so this is currently necessary, but it seems like a complicated
		// and hacky solution to a problem that I don't fully understand.
		// I'd like to revisit this in the future and try to improve the
		// task flow and the communication between the webview and the
		// Cline instance.
		provider?.cancelTask()
	} catch (err) {
		provider?.log("[checkpointRestore] disabling checkpoints for this task")
		cline.enableCheckpoints = false
	}
}

export type CheckpointDiffOptions = {
	ts: number
	previousCommitHash?: string
	commitHash: string
	mode: "full" | "checkpoint"
}

export async function checkpointDiff(cline: Task, { ts, previousCommitHash, commitHash, mode }: CheckpointDiffOptions) {
	const service = await getInitializedCheckpointService(cline)

	if (!service) {
		return
	}

	TelemetryService.instance.captureCheckpointDiffed(cline.taskId)

	if (!previousCommitHash && mode === "checkpoint") {
		const previousCheckpoint = cline.clineMessages
			.filter(({ say }) => say === "checkpoint_saved")
			.sort((a, b) => b.ts - a.ts)
			.find((message) => message.ts < ts)

		previousCommitHash = previousCheckpoint?.text ?? service.baseHash
	}

	try {
		const changes = await service.getDiff({ from: previousCommitHash, to: commitHash })

		if (!changes?.length) {
			vscode.window.showInformationMessage("No changes found.")
			return
		}

		await vscode.commands.executeCommand(
			"vscode.changes",
			mode === "full" ? "Changes since task started" : "Changes since previous checkpoint",
			changes.map((change: any) => [
				vscode.Uri.file(change.paths.absolute),
				vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
					query: Buffer.from(change.content.before ?? "").toString("base64"),
				}),
				vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
					query: Buffer.from(change.content.after ?? "").toString("base64"),
				}),
			]),
		)
	} catch (err) {
		const provider = cline.providerRef.deref()
		provider?.log("[checkpointDiff] disabling checkpoints for this task")
		cline.enableCheckpoints = false
	}
}
