const { execSync } = require("child_process")
const fs = require("fs")

try {
	const packageJson = JSON.parse(fs.readFileSync("./src/package.json", "utf-8"))
	const name = packageJson.name
	const version = packageJson.version
	const vsixFileName = `./bin/${name}-${version}.vsix`

	try {
		execSync(`code --uninstall-extension rooveterinaryinc.roo-cline`, { stdio: "inherit" })
	} catch (e) {
		console.log("Extension not installed, skipping uninstall step")
	}
	execSync(`code --install-extension ${vsixFileName} && code --reload-window`, { stdio: "inherit" })

	console.log(`Successfully installed extension from ${vsixFileName}`)
} catch (error) {
	console.error("Failed to install extension:", error.message)
	process.exit(1)
}
