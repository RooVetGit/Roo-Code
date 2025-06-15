import { spawn } from "child_process"
import fs from "fs"
import { Queue } from "bullmq"

import { redis } from "./redis"

export class WorkerController {
	private queue: Queue
	public isRunning = false
	private pollingInterval: NodeJS.Timeout | null = null
	private readonly POLL_INTERVAL_MS = 5000
	private activeWorkers = new Set<string>()

	constructor() {
		this.queue = new Queue("roomote", { connection: redis })
	}

	async start() {
		if (this.isRunning) {
			console.log("Controller is already running")
			return
		}

		this.isRunning = true
		console.log("Worker controller started")

		await this.checkAndSpawnWorker()

		this.pollingInterval = setInterval(async () => {
			await this.checkAndSpawnWorker()
		}, this.POLL_INTERVAL_MS)
	}

	async stop() {
		if (!this.isRunning) {
			return
		}

		this.isRunning = false
		console.log("Stopping worker controller...")

		if (this.pollingInterval) {
			clearInterval(this.pollingInterval)
			this.pollingInterval = null
		}

		await this.queue.close()
		console.log("Worker controller stopped")
	}

	private async checkAndSpawnWorker() {
		try {
			const waiting = await this.queue.getWaiting()
			const active = await this.queue.getActive()

			const waitingCount = waiting.length
			const activeCount = active.length

			console.log(
				`Queue status: ${waitingCount} waiting, ${activeCount} active, ${this.activeWorkers.size} spawned workers`,
			)

			if (waitingCount > 0 && activeCount === 0 && this.activeWorkers.size === 0) {
				await this.spawnWorker()
			}
		} catch (error) {
			console.error("Error checking queue status:", error)
		}
	}

	private async spawnWorker() {
		const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

		try {
			console.log(`Spawning worker: ${workerId}`)

			const isRunningInDocker = fs.existsSync("/.dockerenv")

			const dockerArgs = [
				`--name roomote-worker-${workerId}`,
				"--rm",
				"--network roomote_default",
				"--env-file /roo/Roo-Code/apps/roomote/.env",
				"-e NODE_ENV=production",
				"-e HOST_EXECUTION_METHOD=docker",
				"-v /var/run/docker.sock:/var/run/docker.sock",
				"-v /tmp/roomote:/var/log/roomote",
			]

			const cliCommand = "cd /roo/Roo-Code/apps/roomote && pnpm worker"

			const command = isRunningInDocker
				? `docker run ${dockerArgs.join(" ")} roomote-worker sh -c "${cliCommand}"`
				: cliCommand

			console.log("Spawning worker with command:", command)

			const childProcess = spawn("sh", ["-c", command], {
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			})

			const logStream = fs.createWriteStream("/tmp/roomote-worker.log", { flags: "a" })

			if (childProcess.stdout) {
				childProcess.stdout.pipe(logStream)
			}

			if (childProcess.stderr) {
				childProcess.stderr.pipe(logStream)
			}

			this.activeWorkers.add(workerId)

			childProcess.on("exit", (code) => {
				console.log(`Worker ${workerId} exited with code ${code}`)
				this.activeWorkers.delete(workerId)
				logStream.end()
			})

			childProcess.on("error", (error) => {
				console.error(`Worker ${workerId} error:`, error)
				this.activeWorkers.delete(workerId)
				logStream.end()
			})

			// Detach the process so it can run independently.
			childProcess.unref()
		} catch (error) {
			console.error(`Failed to spawn worker ${workerId}:`, error)
			this.activeWorkers.delete(workerId)
		}
	}
}

// Only run if this file is executed directly (not imported).
if (import.meta.url === `file://${process.argv[1]}`) {
	const controller = new WorkerController()

	process.on("SIGTERM", async () => {
		console.log("SIGTERM -> shutting down controller gracefully...")
		await controller.stop()
		process.exit(0)
	})

	process.on("SIGINT", async () => {
		console.log("SIGINT -> shutting down controller gracefully...")
		await controller.stop()
		process.exit(0)
	})

	controller.start().catch((error) => {
		console.error("Failed to start controller:", error)
		process.exit(1)
	})
}
