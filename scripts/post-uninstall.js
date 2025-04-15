#!/usr/bin/env node

/**
 * post-uninstall.js
 *
 * This script is executed when the extension is uninstalled.
 * It removes the roocli tool from the user's device and cleans up any files or configurations.
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
const HOME_DIR = os.homedir()

// Determine installation directories based on OS
let binDir
let configDir

console.log("Uninstalling roocli tool...")

try {
	if (isWindows) {
		// Windows uninstallation
		console.log("Detected Windows OS")

		binDir = path.join(HOME_DIR, "AppData", "Local", "RooCode", "bin")
		configDir = path.join(HOME_DIR, "AppData", "Local", "RooCode", "config")

		// Remove batch file
		const batchFilePath = path.join(binDir, "roo.cmd")
		if (fs.existsSync(batchFilePath)) {
			fs.unlinkSync(batchFilePath)
		}

		// Try to remove from PATH
		try {
			// Get current user PATH
			const userPath = execSync("echo %PATH%").toString().trim()

			if (userPath.includes(binDir)) {
				console.log("Removing CLI from PATH...")
				// Create a new PATH without the CLI directory
				const newPath = userPath
					.split(";")
					.filter((p) => p.trim() !== binDir)
					.join(";")

				// Use setx to modify user PATH
				execSync(`setx PATH "${newPath}"`, { stdio: "inherit" })
				console.log("Removed CLI from PATH. You may need to restart your terminal for changes to take effect.")
			}
		} catch (error) {
			console.warn("Could not automatically remove CLI from PATH:", error.message)
			console.log("You may need to manually remove it from your PATH environment variable.")
		}
	} else if (isMac || isLinux) {
		// macOS/Linux uninstallation
		console.log(`Detected ${isMac ? "macOS" : "Linux"} OS`)

		binDir = path.join(HOME_DIR, ".roocode", "bin")
		configDir = path.join(HOME_DIR, ".roocode", "config")

		// Remove symlink from /usr/local/bin if it exists
		const symlinkPath = "/usr/local/bin/roo"
		if (fs.existsSync(symlinkPath)) {
			try {
				fs.unlinkSync(symlinkPath)
				console.log("Removed symlink from /usr/local/bin")
			} catch (error) {
				console.warn("Could not remove symlink (may require admin privileges):", error.message)
				console.log(`To manually remove, run: sudo rm ${symlinkPath}`)
			}
		}

		// Remove from shell config files if added
		const possibleConfigFiles = [
			path.join(HOME_DIR, ".bashrc"),
			path.join(HOME_DIR, ".zshrc"),
			path.join(HOME_DIR, ".bash_profile"),
		]

		for (const configFile of possibleConfigFiles) {
			if (fs.existsSync(configFile)) {
				try {
					let content = fs.readFileSync(configFile, "utf8")

					// Remove RooCode CLI path entries
					const pathPattern = new RegExp(
						`\\n# RooCode CLI\\nexport PATH="\\$PATH:${binDir.replace(/\//g, "\\/")}"\n`,
						"g",
					)
					content = content.replace(pathPattern, "\n")

					fs.writeFileSync(configFile, content)
					console.log(`Removed CLI path from ${configFile}`)
				} catch (error) {
					console.warn(`Could not update ${configFile}:`, error.message)
				}
			}
		}
	} else {
		console.warn("Unsupported operating system:", platform)
	}

	// Clean up installation directories
	console.log("Cleaning up installation directories...")

	// Remove bin directory
	if (binDir && fs.existsSync(binDir)) {
		try {
			fs.rmSync(binDir, { recursive: true, force: true })
			console.log(`Removed bin directory: ${binDir}`)
		} catch (error) {
			console.warn(`Could not remove bin directory: ${error.message}`)
		}
	}

	// Remove config directory
	if (configDir && fs.existsSync(configDir)) {
		try {
			fs.rmSync(configDir, { recursive: true, force: true })
			console.log(`Removed config directory: ${configDir}`)
		} catch (error) {
			console.warn(`Could not remove config directory: ${error.message}`)
		}
	}

	// Check if parent directory is empty and remove it if it is
	const parentDir = path.dirname(binDir)
	if (fs.existsSync(parentDir)) {
		try {
			const files = fs.readdirSync(parentDir)
			if (files.length === 0) {
				fs.rmdirSync(parentDir)
				console.log(`Removed empty parent directory: ${parentDir}`)
			}
		} catch (error) {
			console.warn(`Could not check/remove parent directory: ${error.message}`)
		}
	}

	console.log("roocli uninstallation completed.")
} catch (error) {
	console.error("Error uninstalling roocli:", error)
}
