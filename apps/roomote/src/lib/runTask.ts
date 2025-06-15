import * as path from "path"
import * as os from "node:os"
import * as crypto from "node:crypto"

import pWaitFor from "p-wait-for"
import { execa } from "execa"

import { type TaskEvent, TaskCommandName, RooCodeEventName, IpcMessageType, EVALS_SETTINGS } from "@roo-code/types"
import { IpcClient } from "@roo-code/ipc"

import type { JobPayload, JobType } from "@/types"

import { Logger } from "./logger"
import { isDockerContainer } from "./utils"
import { SlackNotifier } from "./slack"

const TIMEOUT = 30 * 60 * 1_000

class SubprocessTimeoutError extends Error {
	constructor(timeout: number) {
		super(`Subprocess timeout after ${timeout}ms`)
		this.name = "SubprocessTimeoutError"
	}
}

type RunTaskOptions<T extends JobType> = {
	jobType: T
	jobPayload: JobPayload<T>
	prompt: string
	publish: (taskEvent: TaskEvent) => Promise<void>
	logger: Logger
}

export const runTask = async <T extends JobType>({
	jobType,
	jobPayload,
	prompt,
	publish,
	logger,
}: RunTaskOptions<T>) => {
	const workspacePath = "/Users/cte/Documents/Roomote-Control" // findGitRoot(process.cwd())
	const ipcSocketPath = path.resolve(os.tmpdir(), `${crypto.randomUUID().slice(0, 8)}.sock`)
	const env = { ROO_CODE_IPC_SOCKET_PATH: ipcSocketPath }
	const controller = new AbortController()
	const cancelSignal = controller.signal
	const containerized = isDockerContainer()

	const codeCommand = containerized
		? `xvfb-run --auto-servernum --server-num=1 code --wait --log trace --disable-workspace-trust --disable-gpu --disable-lcd-text --no-sandbox --user-data-dir /roo/.vscode --password-store="basic" -n ${workspacePath}`
		: `code --disable-workspace-trust -n ${workspacePath}`

	logger.info(codeCommand)

	// Sleep for a random amount of time between 5 and 10 seconds, unless we're
	// running in a container, in which case there are no issues with flooding
	// VSCode with new windows.
	if (!containerized) {
		await new Promise((resolve) => setTimeout(resolve, Math.random() * 5_000 + 5_000))
	}

	const subprocess = execa({ env, shell: "/bin/bash", cancelSignal })`${codeCommand}`

	// If debugging, add `--verbose` to `command` and uncomment the following line.
	// subprocess.stdout.pipe(process.stdout)

	// Give VSCode some time to spawn before connecting to its unix socket.
	await new Promise((resolve) => setTimeout(resolve, 3_000))
	let client: IpcClient | undefined = undefined
	let attempts = 5

	while (true) {
		try {
			client = new IpcClient(ipcSocketPath)
			await pWaitFor(() => client!.isReady, { interval: 250, timeout: 1_000 })
			break
		} catch (_error) {
			client?.disconnect()
			attempts--

			if (attempts <= 0) {
				logger.error(`unable to connect to IPC socket -> ${ipcSocketPath}`)
				throw new Error("Unable to connect.")
			}
		}
	}

	let taskStartedAt = Date.now()
	let taskFinishedAt: number | undefined
	let taskAbortedAt: number | undefined
	let taskTimedOut: boolean = false
	let rooTaskId: string | undefined
	let isClientDisconnected = false

	const slackNotifier = new SlackNotifier(logger)
	let slackThreadTs: string | null = null

	const ignoreEvents: Record<"broadcast" | "log", RooCodeEventName[]> = {
		broadcast: [RooCodeEventName.Message],
		log: [RooCodeEventName.TaskTokenUsageUpdated, RooCodeEventName.TaskAskResponded],
	}

	client.on(IpcMessageType.TaskEvent, async (taskEvent) => {
		const { eventName, payload } = taskEvent

		// Publish all events except for these to Redis.
		if (!ignoreEvents.broadcast.includes(eventName)) {
			await publish({ ...taskEvent })
		}

		// Log all events except for these.
		// For message events we only log non-partial messages.
		if (
			!ignoreEvents.log.includes(eventName) &&
			(eventName !== RooCodeEventName.Message || payload[0].message.partial !== true)
		) {
			logger.info(`${eventName} ->`, payload)
		}

		if (eventName === RooCodeEventName.TaskStarted) {
			taskStartedAt = Date.now()
			rooTaskId = payload[0]
			slackThreadTs = await slackNotifier.postTaskStarted({ jobType, jobPayload, rooTaskId })
		}

		if (eventName === RooCodeEventName.TaskAborted) {
			taskAbortedAt = Date.now()

			if (slackThreadTs) {
				await slackNotifier.postTaskUpdated(slackThreadTs, "Task was aborted", "warning")
			}
		}

		if (eventName === RooCodeEventName.TaskCompleted) {
			taskFinishedAt = Date.now()

			if (slackThreadTs) {
				await slackNotifier.postTaskCompleted(slackThreadTs, true, taskFinishedAt - taskStartedAt, rooTaskId)
			}
		}
	})

	client.on(IpcMessageType.Disconnect, async () => {
		logger.info(`disconnected from IPC socket -> ${ipcSocketPath}`)
		isClientDisconnected = true
	})

	client.sendCommand({
		commandName: TaskCommandName.StartNewTask,
		data: {
			configuration: {
				...EVALS_SETTINGS,
				openRouterApiKey: process.env.OPENROUTER_API_KEY,
			},
			text: prompt,
			newTab: true,
		},
	})

	try {
		await pWaitFor(() => !!taskFinishedAt || !!taskAbortedAt || isClientDisconnected, {
			interval: 1_000,
			timeout: TIMEOUT,
		})
	} catch (_error) {
		taskTimedOut = true
		logger.error("time limit reached")

		if (slackThreadTs) {
			await slackNotifier.postTaskUpdated(slackThreadTs, "Task timed out after 30 minutes", "error")
		}

		if (rooTaskId && !isClientDisconnected) {
			logger.info("cancelling task")
			client.sendCommand({ commandName: TaskCommandName.CancelTask, data: rooTaskId })
			await new Promise((resolve) => setTimeout(resolve, 5_000)) // Allow some time for the task to cancel.
		}

		taskFinishedAt = Date.now()
	}

	if (!taskFinishedAt && !taskTimedOut) {
		logger.error("client disconnected before task finished")

		if (slackThreadTs) {
			await slackNotifier.postTaskUpdated(slackThreadTs, "Client disconnected before task completion", "error")
		}

		throw new Error("Client disconnected before task completion.")
	}

	if (rooTaskId && !isClientDisconnected) {
		logger.info("closing task")
		client.sendCommand({ commandName: TaskCommandName.CloseTask, data: rooTaskId })
		await new Promise((resolve) => setTimeout(resolve, 2_000)) // Allow some time for the window to close.
	}

	if (!isClientDisconnected) {
		logger.info("disconnecting client")
		client.disconnect()
	}

	logger.info("waiting for subprocess to finish")
	controller.abort()

	// Wait for subprocess to finish gracefully, with a timeout.
	const SUBPROCESS_TIMEOUT = 10_000

	try {
		await Promise.race([
			subprocess,
			new Promise((_, reject) =>
				setTimeout(() => reject(new SubprocessTimeoutError(SUBPROCESS_TIMEOUT)), SUBPROCESS_TIMEOUT),
			),
		])

		logger.info("subprocess finished gracefully")
	} catch (error) {
		if (error instanceof SubprocessTimeoutError) {
			logger.error("subprocess did not finish within timeout, force killing")

			try {
				if (subprocess.kill("SIGKILL")) {
					logger.info("SIGKILL sent to subprocess")
				} else {
					logger.error("failed to send SIGKILL to subprocess")
				}
			} catch (killError) {
				logger.error("subprocess.kill(SIGKILL) failed:", killError)
			}
		} else {
			throw error
		}
	}

	logger.close()
}
