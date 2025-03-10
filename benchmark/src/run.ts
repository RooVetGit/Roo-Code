import * as path from "path"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { runTests } from "@vscode/test-electron"

async function main() {
	const argv = await yargs(hideBin(process.argv))
		.option("exercise", {
			alias: "e",
			type: "string",
			description: "Path to the exercise directory",
			required: true,
		})
		.help().argv

	const extensionDevelopmentPath = path.resolve(__dirname, "../../")
	const extensionTestsPath = path.resolve(__dirname, "./runExercise")
	const testWorkspace = path.resolve(__dirname, argv.exercise)

	await runTests({
		extensionDevelopmentPath: extensionDevelopmentPath,
		extensionTestsPath: extensionTestsPath,
		launchArgs: [testWorkspace, "--disable-extensions"],
		extensionTestsEnv: {
			prompt: `
				Your job is to complete a coding exercise described by \`.docs/instructions.md\`.
				A file with the implementation stubbed out has been created for you, along with a test file.
				To successfully complete the exercise, you must pass all the tests in the test file.
				To confirm that your solution is correct, run the tests with \`yarn test\`.
				Before running the test make sure your environment is set up by running \`corepack enable\` to enable yarn and \`yarn install\` to install the dependencies.
			`
				.trim()
				.split("\n")
				.map((line) => line.trim())
				.join("\n"),
		},
	})
}

main()
	.then(() => {
		console.log("👍")
	})
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
