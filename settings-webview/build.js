const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

// Build the settings webview
console.log("Building settings webview...")
execSync("npm run build", { stdio: "inherit" })

// Create the dist directory if it doesn't exist
const distDir = path.join(__dirname, "dist")
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true })
}

console.log("Settings webview build complete!")
