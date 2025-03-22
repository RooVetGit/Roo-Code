import * as fs from "fs/promises"
import * as path from "path"

import * as vscode from "vscode"

import { RooCodeAPI } from "../../../../src/exports/roo-code.js"

import { IpcServer, IpcServerMessageType } from "@benchmark/ipc"
import { findTask, findRun, createTaskMetrics, updateTask } from "@benchmark/db"

import { waitUntilReady, waitUntilCompleted, sleep } from "./utils.js"

export async function run() {
	/**
	 * Validate environment variables.
	 */

	const tid = process.env.TASK_ID ? parseInt(process.env.TASK_ID) : undefined
	const promptPath = process.env.PROMPT_PATH
	const workspacePath = process.env.WORKSPACE_PATH
	const openRouterApiKey = process.env.OPENROUTER_API_KEY
	const openRouterModelId = process.env.OPENROUTER_MODEL_ID

	if (!tid || !promptPath || !workspacePath || !openRouterApiKey || !openRouterModelId) {
		throw new Error("ENV not configured.")
	}

	const prompt = await fs.readFile(promptPath, "utf-8")

	/**
	 * Fetch and update the task.
	 */

	let task = await findTask(tid)
	task = await updateTask(task.id, { startedAt: new Date() })

	const run = await findRun(task.runId)

	/**
	 * Activate the extension.
	 */

	const extension = vscode.extensions.getExtension<RooCodeAPI>("RooVeterinaryInc.roo-cline")

	if (!extension) {
		throw new Error("Extension not found.")
	}

	const api = extension.isActive ? extension.exports : await extension.activate()

	/**
	 * Wait for the Roo Code to be ready to accept tasks.
	 */

	await waitUntilReady({ api })

	/**
	 * Configure Roo Code as needed.
	 *
	 * Use Claude 3.7 Sonnet via OpenRouter.
	 * Don't require approval for anything.
	 * Run any command without approval.
	 * Disable checkpoints (for performance).
	 */

	await api.setConfiguration({
		apiProvider: "openrouter",
		openRouterApiKey,
		openRouterModelId,
		autoApprovalEnabled: true,
		alwaysAllowReadOnly: true,
		alwaysAllowWrite: true,
		alwaysAllowExecute: true,
		alwaysAllowBrowser: true,
		alwaysApproveResubmit: true,
		alwaysAllowMcp: true,
		alwaysAllowModeSwitch: true,
		enableCheckpoints: false,
	})

	await vscode.workspace
		.getConfiguration("roo-cline")
		.update("allowedCommands", ["*"], vscode.ConfigurationTarget.Global)

	await sleep(1_000)

	/**
	 * Start the IPC server.
	 */

	const server = new IpcServer(run.socketPath, () => {})
	server.listen()

	server.on("connect", (id) =>
		server.send(id, { type: IpcServerMessageType.TaskEvent, data: { eventName: "connect", data: { task } } }),
	)

	api.on("taskStarted", () =>
		server.broadcast({ type: IpcServerMessageType.TaskEvent, data: { eventName: "taskStarted", data: { task } } }),
	)

	api.on("message", (message) =>
		server.broadcast({
			type: IpcServerMessageType.TaskEvent,
			data: { eventName: "message", data: { task, message } },
		}),
	)

	api.on("taskTokenUsageUpdated", (_, usage) =>
		server.broadcast({
			type: IpcServerMessageType.TaskEvent,
			data: { eventName: "taskTokenUsageUpdated", data: { task, usage } },
		}),
	)

	/**
	 * Run the task and wait up to 10 minutes for it to complete.
	 */

	const startTime = Date.now()
	const rooTaskId = await api.startNewTask(prompt)
	let usage

	try {
		usage =
			(await waitUntilCompleted({ api, taskId: rooTaskId, timeout: 5 * 60 * 1_000 })) ||
			api.getTokenUsage(rooTaskId)
	} catch (e: unknown) {
		usage = api.getTokenUsage(rooTaskId)
		console.error(e)
	}

	const taskMetrics = await createTaskMetrics({
		duration: Date.now() - startTime,
		tokensIn: usage.totalTokensIn,
		tokensOut: usage.totalTokensOut,
		tokensContext: usage.contextTokens,
		cacheWrites: usage.totalCacheWrites ?? 0,
		cacheReads: usage.totalCacheReads ?? 0,
		cost: usage.totalCost,
	})

	task = await updateTask(task.id, { taskMetricsId: taskMetrics.id, finishedAt: new Date() })

	server.broadcast({
		type: IpcServerMessageType.TaskEvent,
		data: { eventName: "taskFinished", data: { task, taskMetrics } },
	})

	await fs.writeFile(path.resolve(workspacePath, "usage.json"), JSON.stringify({ ...task, ...taskMetrics }, null, 2))
}
