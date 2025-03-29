import * as fs from "fs"
import * as path from "path"
import * as os from "os"

import pMap from "p-map"
import pWaitFor from "p-wait-for"
import { execa, parseCommandString } from "execa"
import { build, filesystem, GluegunPrompt, GluegunToolbox } from "gluegun"

import {
	type ExerciseLanguage,
	exerciseLanguages,
	RooCodeEventName,
	IpcOrigin,
	IpcMessageType,
	TaskCommandName,
} from "@benchmark/types"
import { type Run, findRun, createRun, finishRun, createTask, Task, getTasks, updateTask } from "@benchmark/db"
import { IpcServer, IpcClient } from "@benchmark/ipc"

import { __dirname, extensionDevelopmentPath, exercisesPath } from "./paths.js"
import { getExercises } from "./exercises.js"

const testCommands: Record<ExerciseLanguage, { commands: string[]; timeout?: number; cwd?: string }> = {
	cpp: { commands: ["cmake -G 'Unix\\ Makefiles' -DEXERCISM_RUN_ALL_TESTS=1 ..", "make"], cwd: "build" }, // timeout 15s bash -c "cd '$dir' && mkdir -p build && cd build && cmake -G 'Unix Makefiles' -DEXERCISM_RUN_ALL_TESTS=1 .. >/dev/null 2>&1 && make >/dev/null 2>&1"
	go: { commands: ["go test"] }, // timeout 15s bash -c "cd '$dir' && go test > /dev/null 2>&1"
	java: { commands: ["./gradlew test"] }, // timeout --foreground 15s bash -c "cd '$dir' && ./gradlew test > /dev/null 2>&1"
	javascript: { commands: ["pnpm install", "pnpm test"], timeout: 30_000 }, // timeout 30s bash -c "cd '$dir' && pnpm install >/dev/null 2>&1 && pnpm test >/dev/null 2>&1"
	python: { commands: ["uv run python3 -m pytest -o markers=task *_test.py"] }, // timeout 15s bash -c "cd '$dir' && uv run python3 -m pytest -o markers=task *_test.py"
	rust: { commands: ["cargo test"] }, // timeout 15s bash -c "cd '$dir' && cargo test > /dev/null 2>&1"
}

const run = async (toolbox: GluegunToolbox) => {
	const { config, prompt } = toolbox

	let { language, exercise } = config

	if (![undefined, ...exerciseLanguages, "all"].includes(language)) {
		throw new Error(`Language is invalid: ${language}`)
	}

	if (!["undefined", "string"].includes(typeof exercise)) {
		throw new Error(`Exercise is invalid: ${exercise}`)
	}

	const id = config.runId ? Number(config.runId) : undefined
	let run: Run

	if (id) {
		run = await findRun(id)
	} else {
		run = await createRun({
			model: "anthropic/claude-3.7-sonnet",
			pid: process.pid,
			socketPath: path.resolve(os.tmpdir(), `benchmark-${crypto.randomUUID()}.sock`),
		})

		if (language === "all") {
			for (const language of exerciseLanguages) {
				const exercises = getExercises()[language as ExerciseLanguage]

				await pMap(exercises, (exercise) => createTask({ runId: run.id, language, exercise }), {
					concurrency: 10,
				})
			}
		} else if (exercise === "all") {
			const exercises = getExercises()[language as ExerciseLanguage]
			await pMap(exercises, (exercise) => createTask({ runId: run.id, language, exercise }), { concurrency: 10 })
		} else {
			language = language || (await askLanguage(prompt))
			exercise = exercise || (await askExercise(prompt, language))
			await createTask({ runId: run.id, language, exercise })
		}
	}

	const tasks = await getTasks(run.id)
	let currentTask = tasks[0]

	if (!currentTask) {
		throw new Error("No tasks found.")
	}

	// const server = new IpcServer(run.socketPath, () => {})
	// server.listen()

	// server.on("connect", (clientId) => {
	// 	server.send(clientId, {
	// 		type: IpcMessageType.TaskEvent,
	// 		origin: IpcOrigin.Server,
	// 		data: { eventName: TaskEventName.Connect, data: { task: currentTask! } },
	// 	})
	// })

	// server.on("taskEvent", (relayClientId, data) => {
	// 	server.broadcast({
	// 		type: IpcMessageType.TaskEvent,
	// 		origin: IpcOrigin.Server,
	// 		relayClientId,
	// 		data,
	// 	})
	// })

	for (const task of tasks) {
		currentTask = task

		await runExercise({ run, task })

		const cmd = testCommands[task.language]
		const exercisePath = path.resolve(exercisesPath, task.language, task.exercise)
		const cwd = cmd.cwd ? path.resolve(exercisePath, cmd.cwd) : exercisePath
		const commands = cmd.commands.map((cs) => parseCommandString(cs))

		let passed = true

		for (const command of commands) {
			const controller = new AbortController()
			const cancelSignal = controller.signal
			const timeout = setTimeout(() => controller.abort(), cmd.timeout ?? 15_000)

			try {
				const result = await execa({ cwd, shell: true, reject: false, cancelSignal })`${command}`
				console.log({ ...result, cwd, command })

				clearTimeout(timeout)

				if (result.failed) {
					passed = false
					break
				}
			} catch (error) {
				console.log(error)
				passed = false
				break
			}
		}

		await updateTask(task.id, { passed })
	}

	const result = await finishRun(run.id)
	console.log(result)
}

const runExercise = async ({ run, task }: { run: Run; task: Task }) => {
	const { language, exercise } = task
	const workspacePath = path.resolve(exercisesPath, language, exercise)

	if (task.finishedAt) {
		console.log(`Test result exists for ${language} / ${exercise}, skipping`)
		return false
	}

	const promptPath = path.resolve(exercisesPath, `prompts/${language}.md`)

	if (!fs.existsSync(promptPath)) {
		throw new Error(`Prompt file does not exist: ${promptPath}`)
	}

	const prompt = fs.readFileSync(promptPath, "utf-8")

	console.log(`code -n ${workspacePath}`)
	const dirname = path.dirname(run.socketPath)
	const basename = path.basename(run.socketPath, ".sock")
	const taskSocketPath = path.resolve(dirname, `${dirname}/${basename}-${task.id}.sock`)
	await execa({ env: { ROO_CODE_IPC_SOCKET_PATH: taskSocketPath } })`code -n ${workspacePath}`

	console.log(`Connecting to ${taskSocketPath}`)
	let tries = 0
	let client = new IpcClient(taskSocketPath)

	while (true) {
		try {
			await pWaitFor(() => client.isConnected, { interval: 250, timeout: 1_000 })
			break
		} catch (error) {
			console.error(error)

			if (++tries > 10) {
				return false
			}

			client = new IpcClient(taskSocketPath)
		}
	}

	console.log(`Running ${language} / ${exercise}`)

	client.sendMessage({
		type: IpcMessageType.TaskCommand,
		origin: IpcOrigin.Client,
		clientId: client.clientId!,
		data: {
			commandName: TaskCommandName.StartNewTask,
			data: { text: prompt },
		},
	})

	let isTaskFinished = false

	client.on("taskEvent", ({ eventName, payload }) => {
		console.log(`${eventName}`)

		if (eventName === RooCodeEventName.Message) {
			const { message } = payload[0]
			console.log(`${message.ts}: ${message.text}`)
		}

		if (eventName === RooCodeEventName.TaskCompleted || eventName === RooCodeEventName.TaskAborted) {
			console.log("task finished")
			isTaskFinished = true
		}
	})

	try {
		await pWaitFor(() => isTaskFinished, { interval: 1_000, timeout: 300 * 1_000 })
		client.disconnect()
		return true
	} catch (error) {
		console.error(error)
		client.disconnect()
		return false
	}
}

const askLanguage = async (prompt: GluegunPrompt) => {
	const { language } = await prompt.ask<{ language: ExerciseLanguage }>({
		type: "select",
		name: "language",
		message: "Which language?",
		choices: [...exerciseLanguages],
	})

	return language
}

const askExercise = async (prompt: GluegunPrompt, language: ExerciseLanguage) => {
	const exercises = filesystem.subdirectories(path.join(exercisesPath, language))

	if (exercises.length === 0) {
		throw new Error(`No exercises found for ${language}`)
	}

	const { exercise } = await prompt.ask<{ exercise: string }>({
		type: "select",
		name: "exercise",
		message: "Which exercise?",
		choices: exercises.map((exercise) => path.basename(exercise)).filter((exercise) => !exercise.startsWith(".")),
	})

	return exercise
}

const main = async () => {
	const cli = build()
		.brand("cli")
		.src(__dirname)
		.help()
		.version()
		.command({
			name: "run",
			description: "Run a benchmark",
			run: ({ config, parameters }) => {
				config.language = parameters.first
				config.exercise = parameters.second

				if (parameters.options["runId"]) {
					config.runId = parameters.options["runId"]
				}
			},
		})
		.defaultCommand()
		.create()

	const toolbox = await cli.run(process.argv)
	const { print, command } = toolbox

	try {
		switch (command?.name) {
			case "run":
				await run(toolbox)
				break
		}

		process.exit(0)
	} catch (error: unknown) {
		print.error(error instanceof Error ? error.message : String(error))
		process.exit(1)
	}
}

if (!fs.existsSync(extensionDevelopmentPath)) {
	console.error(`"extensionDevelopmentPath" does not exist.`)
	process.exit(1)
}

if (!fs.existsSync(exercisesPath)) {
	console.error(
		`Exercises path does not exist. Please run "git clone https://github.com/cte/Roo-Code-Benchmark.git exercises".`,
	)
	process.exit(1)
}

main()
