import * as fs from "fs/promises"
import * as path from "path"

import * as vscode from "vscode"

import { RooCodeAPI } from "../../../../src/exports/roo-code.js"

import { IpcOrigin, IpcMessageType, TaskEventName, rooCodeDefaults } from "@benchmark/types"
import { IpcClient } from "@benchmark/ipc"
import { findTask, findRun, createTaskMetrics, updateTask } from "@benchmark/db"

import { waitUntilReady, waitUntilCompleted, sleep } from "./utils.js"

export async function run() {
	/**
	 * Validate environment variables.
	 */

	const taskId = process.env.TASK_ID ? parseInt(process.env.TASK_ID) : undefined
	const promptPath = process.env.PROMPT_PATH
	const workspacePath = process.env.WORKSPACE_PATH
	const openRouterApiKey = process.env.OPENROUTER_API_KEY
	const openRouterModelId = process.env.OPENROUTER_MODEL_ID

	if (!taskId || !promptPath || !workspacePath || !openRouterApiKey || !openRouterModelId) {
		throw new Error(
			`ENV not configured. ${JSON.stringify({ taskId, promptPath, workspacePath, openRouterApiKey, openRouterModelId })}`,
		)
	}

	const prompt = await fs.readFile(promptPath, "utf-8")

	/**
	 * Fetch and update the task.
	 */

	let task = await findTask(taskId)
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
	 * Configure Roo Code as needed. First apply defaults, then apply the
	 * run-specific settings.
	 */

	await api.setConfiguration({
		apiProvider: "openrouter",
		openRouterApiKey,
		openRouterModelId,
		...rooCodeDefaults,
		...Object.fromEntries(Object.entries(run.settings ?? {}).filter(([, value]) => value !== undefined)),
	})

	await vscode.workspace
		.getConfiguration("roo-cline")
		.update("allowedCommands", ["*"], vscode.ConfigurationTarget.Global)

	await sleep(1_000)

	/**
	 * Start the IPC client.
	 */

	const client = new IpcClient(run.socketPath, () => {})
	const clientStartedAt = Date.now()

	while (!client.clientId && Date.now() - clientStartedAt < 10_000) {
		await sleep(250)
	}

	if (!client.clientId) {
		throw new Error("No client ID received.")
	}

	api.on("taskStarted", () =>
		client.sendMessage({
			type: IpcMessageType.TaskEvent,
			relayClientId: client.clientId,
			origin: IpcOrigin.Relay,
			data: { eventName: TaskEventName.TaskStarted, data: { task } },
		}),
	)

	api.on("message", (message) =>
		client.sendMessage({
			type: IpcMessageType.TaskEvent,
			relayClientId: client.clientId,
			origin: IpcOrigin.Relay,
			data: { eventName: TaskEventName.Message, data: { task, message } },
		}),
	)

	api.on("taskTokenUsageUpdated", (_, usage) =>
		client.sendMessage({
			type: IpcMessageType.TaskEvent,
			relayClientId: client.clientId,
			origin: IpcOrigin.Relay,
			data: { eventName: TaskEventName.TaskTokenUsageUpdated, data: { task, usage } },
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

	client.sendMessage({
		type: IpcMessageType.TaskEvent,
		relayClientId: client.clientId,
		origin: IpcOrigin.Relay,
		data: { eventName: TaskEventName.TaskFinished, data: { task, taskMetrics } },
	})

	await fs.writeFile(path.resolve(workspacePath, "usage.json"), JSON.stringify({ ...task, ...taskMetrics }, null, 2))
}
