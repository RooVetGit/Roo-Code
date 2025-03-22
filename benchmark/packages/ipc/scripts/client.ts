import { IpcClientMessageType, IpcClient } from "../src/index.js"

async function main(socketPath: string, prompt: string) {
	try {
		const startTime = Date.now()
		const client = new IpcClient(socketPath)

		client.on("message", (data) => console.log(data))

		while (!client.isConnected) {
			if (Date.now() - startTime > 5000) {
				throw new Error("Failed to connect to server.")
			}

			await new Promise((resolve) => setTimeout(resolve, 1000))
		}

		client.sendMessage({ type: IpcClientMessageType.StartNewTask, data: { text: prompt } })

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
