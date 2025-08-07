#!/usr/bin/env node

const { spawn, execSync } = require("child_process")
const path = require("path")
const fs = require("fs")

const colors = {
	yellow: "\x1b[33m",
	green: "\x1b[32m",
	blue: "\x1b[34m",
	red: "\x1b[31m",
	reset: "\x1b[0m",
}

const log = (color, message) => {
	console.log(`${colors[color]}${message}${colors.reset}`)
}

const cloudSdkPath = path.join(__dirname, "../../Roo-Code-Cloud/packages/sdk")
const extensionPath = path.join(__dirname, "../src")
const extensionNodeModules = path.join(extensionPath, "node_modules")
const targetPath = path.join(extensionNodeModules, "@roo-code/cloud")

if (!fs.existsSync(cloudSdkPath)) {
	log("red", "❌ Error: Roo-Code-Cloud repository not found at ../Roo-Code-Cloud")
	log("yellow", "Please ensure the Roo-Code-Cloud repository is cloned adjacent to the Roo-Code repository.")
	process.exit(1)
}

log("yellow", "🔗 Setting up @roo-code/cloud SDK link...")

try {
	// Step 1: Check if dependencies are already installed
	log("yellow", "📦 Checking SDK dependencies...")
	const nodeModulesPath = path.join(cloudSdkPath, "node_modules")

	if (!fs.existsSync(nodeModulesPath)) {
		log("yellow", "📦 Installing SDK dependencies...")

		try {
			execSync("pnpm install", {
				cwd: cloudSdkPath,
				stdio: "inherit",
				env: { ...process.env, FORCE_COLOR: "1" },
			})
		} catch (installError) {
			log("red", "❌ Failed to install dependencies. Trying with --no-frozen-lockfile...")

			execSync("pnpm install --no-frozen-lockfile", {
				cwd: cloudSdkPath,
				stdio: "inherit",
				env: { ...process.env, FORCE_COLOR: "1" },
			})
		}
	} else {
		log("green", "✓ Dependencies already installed")
	}

	// Step 2: Build in development mode
	log("yellow", "🔨 Building SDK in development mode...")

	execSync("pnpm build:development", {
		cwd: cloudSdkPath,
		stdio: "inherit",
		env: { ...process.env, FORCE_COLOR: "1" },
	})

	// Step 3: Build for npm directory
	log("yellow", "📦 Building for npm directory...")

	execSync("NODE_ENV=development pnpm tsup --outDir npm/dist", {
		cwd: cloudSdkPath,
		stdio: "inherit",
		env: { ...process.env, NODE_ENV: "development", FORCE_COLOR: "1" },
	})

	// Step 4: Remove existing link if it exists
	if (fs.existsSync(targetPath)) {
		log("yellow", "🗑️  Removing existing @roo-code/cloud package...")
		fs.rmSync(targetPath, { recursive: true, force: true })
	}

	// Step 5: Create @roo-code directory if needed
	const rooCodeDir = path.join(extensionNodeModules, "@roo-code")
	if (!fs.existsSync(rooCodeDir)) {
		fs.mkdirSync(rooCodeDir, { recursive: true })
	}

	// Step 6: Create symlink
	const npmPath = path.join(cloudSdkPath, "npm")
	fs.symlinkSync(npmPath, targetPath, "dir")

	log("green", "✅ @roo-code/cloud SDK linked successfully!")
	log("green", `📍 Linked: ${targetPath} → ${npmPath}`)
} catch (error) {
	log("red", "❌ Error during linking process:")
	console.error(error.message)
	process.exit(1)
}

log("blue", "🚀 Starting SDK watch mode...\n")

const sdkProcess = spawn("pnpm", ["build:development:watch"], {
	cwd: cloudSdkPath,
	stdio: ["inherit", "pipe", "pipe"],
	shell: true,
})

sdkProcess.stdout.on("data", (data) => {
	process.stdout.write(`${colors.blue}[SDK]${colors.reset} ${data}`)
})

sdkProcess.stderr.on("data", (data) => {
	process.stderr.write(`${colors.red}[SDK]${colors.reset} ${data}`)
})

const cleanup = () => {
	log("yellow", "\n🛑 Stopping SDK watch mode...")
	sdkProcess.kill()
	process.exit(0)
}

process.on("SIGINT", cleanup)
process.on("SIGTERM", cleanup)

log("green", "\n✅ SDK is now linked and watching for changes!")
log("yellow", "\n📝 Next steps:")
log("yellow", "1. Press F5 in VSCode to launch the extension")
log("yellow", "2. The extension will automatically reload when SDK changes are detected")
log("yellow", "3. Press Ctrl+C here to stop the SDK watch mode\n")
