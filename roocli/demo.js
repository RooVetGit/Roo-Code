#!/usr/bin/env node

/**
 * RooCode CLI Demo Script
 *
 * This script demonstrates how to use the RooCode CLI programmatically
 * to create a complete workflow: creating a profile, setting it active,
 * starting a task, and interacting with it.
 *
 * Prerequisites:
 * - VS Code must be running with the RooCode extension
 * - WebSocket server must be enabled in RooCode settings
 *
 * Usage:
 * node demo.js
 */

const { exec } = require("child_process")
const readline = require("readline")

// Create a readline interface for user input
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

/**
 * Execute a RooCode CLI command and return the result
 * @param {string} command - The command to execute
 * @returns {Promise<string>} - The command output
 */
function executeRooCommand(command) {
	return new Promise((resolve, reject) => {
		console.log(`Executing: roo ${command}`)

		exec(`roo ${command}`, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error executing command: ${error.message}`)
				reject(error)
				return
			}

			if (stderr) {
				console.error(`Command stderr: ${stderr}`)
			}

			resolve(stdout)
		})
	})
}

/**
 * Check if RooCode is ready
 * @returns {Promise<boolean>} - Whether RooCode is ready
 */
async function checkRooCodeReady() {
	try {
		const output = await executeRooCommand("get --ready")
		return output.includes("Ready")
	} catch (error) {
		console.error("Failed to check if RooCode is ready:", error)
		return false
	}
}

/**
 * Create a new profile
 * @param {string} profileName - The name of the profile to create
 * @returns {Promise<string>} - The profile ID
 */
async function createProfile(profileName) {
	try {
		const output = await executeRooCommand(`create profile "${profileName}"`)
		const match = output.match(/ID: ([a-zA-Z0-9-]+)/)
		return match ? match[1] : null
	} catch (error) {
		console.error(`Failed to create profile "${profileName}":`, error)
		throw error
	}
}

/**
 * Set a profile as active
 * @param {string} profileName - The name of the profile to set as active
 * @returns {Promise<void>}
 */
async function setActiveProfile(profileName) {
	try {
		await executeRooCommand(`set profile "${profileName}" --active`)
		console.log(`Profile "${profileName}" set as active`)
	} catch (error) {
		console.error(`Failed to set profile "${profileName}" as active:`, error)
		throw error
	}
}

/**
 * Start a new task
 * @param {string} taskDescription - The task description
 * @param {boolean} newTab - Whether to open the task in a new tab
 * @returns {Promise<string>} - The task ID
 */
async function startTask(taskDescription, newTab = false) {
	try {
		const tabOption = newTab ? " --tab" : ""
		const output = await executeRooCommand(`task new "${taskDescription}"${tabOption}`)
		const match = output.match(/ID: ([a-zA-Z0-9-]+)/)
		return match ? match[1] : null
	} catch (error) {
		console.error(`Failed to start task "${taskDescription}":`, error)
		throw error
	}
}

/**
 * Send a message to the current task
 * @param {string} message - The message to send
 * @returns {Promise<void>}
 */
async function sendMessage(message) {
	try {
		await executeRooCommand(`task message "${message}"`)
		console.log(`Message sent: "${message}"`)
	} catch (error) {
		console.error(`Failed to send message "${message}":`, error)
		throw error
	}
}

/**
 * Clear the current task
 * @param {string} finalMessage - The final message for the task
 * @returns {Promise<void>}
 */
async function clearTask(finalMessage) {
	try {
		await executeRooCommand(`task clear --message "${finalMessage}"`)
		console.log(`Task cleared with message: "${finalMessage}"`)
	} catch (error) {
		console.error(`Failed to clear task:`, error)
		throw error
	}
}

/**
 * Get all profiles
 * @returns {Promise<string[]>} - Array of profile names
 */
async function getProfiles() {
	try {
		const output = await executeRooCommand("get --profiles")
		// Extract profile names from the output
		const profilesMatch = output.match(/│(.+)│/g)
		if (profilesMatch) {
			// Clean up the extracted profile names
			return profilesMatch[1]
				.split("\n")
				.map((p) => p.trim())
				.filter((p) => p && !p.includes("Profiles"))
		}
		return []
	} catch (error) {
		console.error("Failed to get profiles:", error)
		return []
	}
}

/**
 * Main function to run the demo
 */
async function runDemo() {
	try {
		console.log("RooCode CLI Demo")
		console.log("----------------")

		// Step 1: Check if RooCode is ready
		console.log("\nStep 1: Checking if RooCode is ready...")
		const isReady = await checkRooCodeReady()

		if (!isReady) {
			console.error(
				"RooCode is not ready. Please make sure VS Code is running with the RooCode extension and the WebSocket server is enabled.",
			)
			process.exit(1)
		}

		console.log("RooCode is ready!")

		// Step 2: Create a new profile
		console.log("\nStep 2: Creating a new profile...")
		const profileName = "Demo Profile"
		const profileId = await createProfile(profileName)
		console.log(`Profile created with ID: ${profileId}`)

		// Step 3: Set the profile as active
		console.log("\nStep 3: Setting the profile as active...")
		await setActiveProfile(profileName)

		// Step 4: Start a new task
		console.log("\nStep 4: Starting a new task...")
		const taskDescription = "Create a simple React component with a button that increments a counter"
		const taskId = await startTask(taskDescription)
		console.log(`Task started with ID: ${taskId}`)

		// Wait for user input before continuing
		await new Promise((resolve) => {
			rl.question("\nPress Enter to continue to the next step...", resolve)
		})

		// Step 5: Send additional instructions
		console.log("\nStep 5: Sending additional instructions...")
		await sendMessage("Add a reset button that sets the counter back to zero")

		// Wait for user input before continuing
		await new Promise((resolve) => {
			rl.question("\nPress Enter to continue to the next step...", resolve)
		})

		// Step 6: Clear the task
		console.log("\nStep 6: Clearing the task...")
		await clearTask("Thank you for creating the component!")

		console.log("\nDemo completed successfully!")

		// Optional: Clean up by deleting the demo profile
		const shouldDelete = await new Promise((resolve) => {
			rl.question("\nDo you want to delete the demo profile? (y/n): ", (answer) => {
				resolve(answer.toLowerCase() === "y")
			})
		})

		if (shouldDelete) {
			console.log("\nDeleting the demo profile...")
			await executeRooCommand(`delete profile "${profileName}" --force`)
			console.log(`Profile "${profileName}" deleted`)
		}
	} catch (error) {
		console.error("Demo failed:", error)
	} finally {
		rl.close()
	}
}

// Run the demo
runDemo()
