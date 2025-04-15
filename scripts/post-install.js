#!/usr/bin/env node

/**
 * post-install.js
 *
 * This script is executed when the extension is installed.
 * It installs the roocli tool on the user's device and makes it accessible from the command line.
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const os = require("os")

// Determine the OS
const platform = process.platform
const isWindows = platform === "win32"
const isMac = platform === "darwin"
const isLinux = platform === "linux"

// Paths
const EXTENSION_DIR = path.resolve(__dirname, "..")
const CLI_DIR = path.join(EXTENSION_DIR, "dist", "cli")
const HOME_DIR = os.homedir()

// Create installation directories based on OS
let binDir
let configDir

console.log("Installing roocli tool...")

try {
	if (isWindows) {
		// Windows installation
		console.log("Detected Windows OS")

		// Create directories if they don't exist
		binDir = path.join(HOME_DIR, "AppData", "Local", "RooCode", "bin")
		configDir = path.join(HOME_DIR, "AppData", "Local", "RooCode", "config")

		if (!fs.existsSync(binDir)) {
			fs.mkdirSync(binDir, { recursive: true })
		}

		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true })
		}

		// Copy CLI files to bin directory
		fs.cpSync(CLI_DIR, binDir, { recursive: true })

		// Install dependencies
		console.log("Installing CLI dependencies...")
		try {
			execSync("npm install --production", {
				cwd: binDir,
				stdio: "inherit",
			})
			console.log("CLI dependencies installed successfully.")
		} catch (error) {
			console.warn("Failed to install CLI dependencies:", error.message)
			console.log("You may need to manually install dependencies by running:")
			console.log(`cd ${binDir} && npm install --production`)
		}

		// Create batch file for CLI
		const batchFilePath = path.join(binDir, "roo.cmd")
		const batchFileContent = `@echo off\r\nnode "%~dp0\\index.js" %*`
		fs.writeFileSync(batchFilePath, batchFileContent)

		// Add to PATH if not already there
		try {
			// Get current user PATH
			const userPath = execSync("echo %PATH%").toString().trim()

			if (!userPath.includes(binDir)) {
				console.log("Adding CLI to PATH...")
				// Use setx to modify user PATH
				execSync(`setx PATH "%PATH%;${binDir}"`, { stdio: "inherit" })
				console.log("Added CLI to PATH. You may need to restart your terminal for changes to take effect.")
			}
		} catch (error) {
			console.warn("Could not automatically add CLI to PATH. You may need to add it manually:", binDir)
		}
	} else if (isMac || isLinux) {
		// macOS/Linux installation
		console.log(`Detected ${isMac ? "macOS" : "Linux"} OS`)

		// Create directories if they don't exist
		binDir = path.join(HOME_DIR, ".roocode", "bin")
		configDir = path.join(HOME_DIR, ".roocode", "config")

		if (!fs.existsSync(binDir)) {
			fs.mkdirSync(binDir, { recursive: true })
		}

		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true })
		}

		// Copy CLI files to bin directory
		fs.cpSync(CLI_DIR, binDir, { recursive: true })

		// Install dependencies
		console.log("Installing CLI dependencies...")
		try {
			execSync("npm install --production", {
				cwd: binDir,
				stdio: "inherit",
			})
			console.log("CLI dependencies installed successfully.")
		} catch (error) {
			console.warn("Failed to install CLI dependencies:", error.message)
			console.log("You may need to manually install dependencies by running:")
			console.log(`cd ${binDir} && npm install --production`)
		}

		// Create symlink in /usr/local/bin if possible
		const symlinkPath = "/usr/local/bin/roo"
		const cliPath = path.join(binDir, "index.js")

		// Make CLI executable
		fs.chmodSync(cliPath, "755")

		// Create executable script
		const scriptPath = path.join(binDir, "roo")
		const scriptContent = `#!/bin/bash\nnode "${cliPath}" "$@"`
		fs.writeFileSync(scriptPath, scriptContent)
		fs.chmodSync(scriptPath, "755")

		try {
			// Try to create symlink in /usr/local/bin (may require sudo)
			if (fs.existsSync(symlinkPath)) {
				fs.unlinkSync(symlinkPath)
			}

			try {
				fs.symlinkSync(scriptPath, symlinkPath)
				console.log("Created symlink in /usr/local/bin")
			} catch (error) {
				// If symlink creation fails, suggest manual installation
				console.log("Could not create symlink in /usr/local/bin (may require admin privileges)")
				console.log(`To manually install, run: sudo ln -s ${scriptPath} ${symlinkPath}`)

				// Alternative: add to user's .bashrc or .zshrc
				const shellConfigFile = path.join(HOME_DIR, isMac ? ".zshrc" : ".bashrc")

				if (fs.existsSync(shellConfigFile)) {
					console.log(`Adding CLI path to ${shellConfigFile}...`)
					const pathAddition = `\n# RooCode CLI\nexport PATH="$PATH:${binDir}"\n`
					fs.appendFileSync(shellConfigFile, pathAddition)
					console.log(
						`Added CLI to ${shellConfigFile}. Please restart your terminal or run 'source ${shellConfigFile}'`,
					)
				}
			}
		} catch (error) {
			console.warn("Could not set up CLI in PATH:", error.message)
			console.log(`To manually install, add ${binDir} to your PATH or create a symlink to ${scriptPath}`)
		}
	} else {
		console.warn("Unsupported operating system:", platform)
		console.log("Please manually install the CLI tool from:", CLI_DIR)
	}

	console.log("roocli installation completed.")
	console.log('You can now use the "roo" command in your terminal.')
} catch (error) {
	console.error("Error installing roocli:", error)
}
