import fs from "fs"
import path from "path"
import readline from "readline"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
	const datasetPath = path.join(__dirname, "..", "datasets", "swebench_test.jsonl")

	try {
		const input = fs.createReadStream(datasetPath, { encoding: "utf-8" })
		const rl = readline.createInterface({ input, crlfDelay: Infinity })

		for await (const line of rl) {
			console.log(`Line: ${line}`)
			// console.log(JSON.parse(line))
			// break
		}

		rl.close()
		input.close()
	} catch (error) {
		console.error("Error reading file:", error)
	}
}

main().catch((error) => {
	console.error("Unhandled error:", error)
})
