import { TaskCommandName } from "@benchmark/types"

import { IpcMessageType, IpcOrigin } from "@benchmark/types"
import { IpcClient } from "../src/index.js"

async function main(socketPath: string, prompt: string) {
	try {
		const client = new IpcClient(socketPath)
		const clientStartedAt = Date.now()

		while (!client.isConnected && Date.now() - clientStartedAt < 10_000) {
			await new Promise((resolve) => setTimeout(resolve, 250))
		}

		if (!client.isConnected) {
			throw new Error("Failed to connect to server.")
		}

		client.on("taskEvent", (data) => console.log(data))

		client.sendMessage({
			type: IpcMessageType.TaskCommand,
			origin: IpcOrigin.Client,
			clientId: client.clientId!,
			data: { commandName: TaskCommandName.StartNewTask, data: { text: prompt } },
		})

		while (client.isConnected) {
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}

		process.exit(0)
	} catch (e) {
		console.error(e)
		process.exit(1)
	}
}

if (!process.argv[2]) {
	console.error("Usage: npx tsx scripts/client.ts <socketPath> <prompt>")
	process.exit(1)
}

main(process.argv[2], process.argv[3])
