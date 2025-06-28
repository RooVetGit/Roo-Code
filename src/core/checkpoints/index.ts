import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"

import { getWorkspacePath } from "../../utils/path"

import { ClineApiReqInfo } from "../../shared/ExtensionMessage"
import { getApiMetrics } from "../../shared/getApiMetrics"

import { DIFF_VIEW_URI_SCHEME } from "../../integrations/editor/DiffViewProvider"

import { FileChangeManager } from "../../services/file-changes/FileChangeManager"
import { CheckpointServiceOptions, RepoPerTaskCheckpointService } from "../../services/checkpoints"
import { CheckpointResult } from "../../services/checkpoints/types"

export function getCheckpointService(cline: Task) {
	if (cline.options.checkpointService) {
		return cline.options.checkpointService
	}
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

		service.on("initialize", () => {
			log("[Task#getCheckpointService] service initialized")

			try {
				// Debug logging to understand checkpoint detection
				console.log("[DEBUG] Checkpoint detection - total messages:", cline.clineMessages.length)
				console.log(
					"[DEBUG] Checkpoint detection - message types:",
					cline.clineMessages.map((m) => ({
						ts: m.ts,
						type: m.type,
						say: m.say,
						ask: m.ask,
					})),
				)

				const checkpointMessages = cline.clineMessages.filter(({ say }) => say === "checkpoint_saved")
				console.log(
					"[DEBUG] Found checkpoint messages:",
					checkpointMessages.length,
					checkpointMessages.map((m) => ({ ts: m.ts, text: m.text })),
				)

				const isCheckpointNeeded =
					typeof cline.clineMessages.find(({ say }) => say === "checkpoint_saved") === "undefined"

				console.log("[DEBUG] isCheckpointNeeded result:", isCheckpointNeeded)

				cline.checkpointService = service
				cline.checkpointServiceInitializing = false

				// Create FileChangeManager immediately after checkpoint service initialization
				// This ensures it exists before any baseline update attempts in resumeTaskFromHistory()
				if (!cline.fileChangeManager && provider) {
					try {
						const baseHash = service.baseHash || "HEAD"
						cline.fileChangeManager = new FileChangeManager(
							baseHash,
							cline.taskId,
							provider.context.globalStorageUri.fsPath,
						)
						log(`[Task#getCheckpointService] FileChangeManager created with baseline: ${baseHash}`)
					} catch (error) {
						log(`[Task#getCheckpointService] Failed to create FileChangeManager: ${error}`)
						// Continue without FileChangeManager - checkpoint functionality will still work
					}
				} else if (cline.fileChangeManager) {
					log("[Task#getCheckpointService] FileChangeManager already exists, skipping creation")
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
					{
						isNonInteractive: true,
					},
				)

				// FileChangeManager is now created during service initialization
				// This ensures it exists before any baseline update attempts
				// File change tracking is now handled at the time of LLM edits in saveChanges(),
				// not during checkpoint creation. This prevents rejected files from reappearing
				// when new checkpoints are created.

				// Send current file changes to the webview (if any exist)
				if (cline.fileChangeManager) {
					const changeset = cline.fileChangeManager.getChanges()
					if (changeset.files.length > 0) {
						const serializableChangeset = {
							...changeset,
							files: Array.from(changeset.files.values()),
						}

						provider?.postMessageToWebview({
							type: "filesChanged",
							filesChanged: serializableChangeset,
						})
					}
				}
			} catch (err) {
				log("[Task#getCheckpointService] caught unexpected error in on('checkpoint'), disabling checkpoints")
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

	TelemetryService.instance.captureCheckpointCreated(cline.taskId)

	// Start the checkpoint process in the background and track it
	const savePromise = service
		.saveCheckpoint(`Task: ${cline.taskId}, Time: ${Date.now()}`, { allowEmpty: force, files })
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

		if (cline.fileChangeManager) {
			await cline.fileChangeManager.updateBaseline(commitHash, (from, to) => service.getDiff({ from, to }))
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
