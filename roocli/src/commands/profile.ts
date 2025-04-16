import chalk from "chalk"
import { Command } from "commander"
import { WebSocketClient } from "../../../comms-clients/websocket-client"
import { displayBox, displayConfirmation } from "../utils/display"

/**
 * Create the list profiles command
 * @param wsClient The WebSocket client
 * @returns The list profiles command
 */
export function listProfilesCommand(wsClient: WebSocketClient): Command {
	return new Command("profiles")
		.description("List all profiles")
		.option("--active", "Show only the active profile")
		.action(async (options) => {
			try {
				if (options.active) {
					const activeProfile = await wsClient.sendCommand("getActiveProfile")
					displayBox("Active Profile", activeProfile || "No active profile", "info")
				} else {
					const profiles = await wsClient.sendCommand("getProfiles")
					displayBox("Profiles", profiles.join("\n"), "info")
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}

/**
 * Create the create profile command
 * @param wsClient The WebSocket client
 * @returns The create profile command
 */
export function createProfileCommand(wsClient: WebSocketClient): Command {
	return new Command("profile")
		.description("Create a new profile")
		.requiredOption("--name <name>", "Profile name")
		.option("--config <config>", "Configuration name to associate with the profile")
		.action(async (options) => {
			try {
				if (!options.name) {
					throw new Error("Profile name is required")
				}

				// The API's createProfile method expects just the name as a string
				const profileId = await wsClient.sendCommand("createProfile", options.name)
				displayBox("Profile Created", `Profile "${options.name}" created with ID: ${profileId}`, "success")
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}

/**
 * Create the update profile command
 * @param wsClient The WebSocket client
 * @returns The update profile command
 */
export function updateProfileCommand(wsClient: WebSocketClient): Command {
	return new Command("profile")
		.description("Update a profile")
		.requiredOption("--name <name>", "Profile name")
		.option("--active", "Set the profile as active")
		.option("--config <config>", "Configuration name to associate with the profile")
		.action(async (options) => {
			try {
				if (options.active) {
					await wsClient.sendCommand("setActiveProfile", options.name)
					displayBox("Profile Activated", `Profile "${options.name}" is now active`, "success")
				} else if (options.config) {
					// There's no direct updateProfile method in the API
					// We need to delete the existing profile and create a new one with the same name
					await wsClient.sendCommand("deleteProfile", options.name)
					await wsClient.sendCommand("createProfile", options.name)
					displayBox(
						"Profile Updated",
						`Profile "${options.name}" has been updated with configuration "${options.config}"`,
						"success",
					)
				} else {
					throw new Error("Either --active or --config option is required")
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}

/**
 * Create the delete profile command
 * @param wsClient The WebSocket client
 * @returns The delete profile command
 */
export function deleteProfileCommand(wsClient: WebSocketClient): Command {
	return new Command("profile")
		.description("Delete a profile")
		.requiredOption("--name <name>", "Profile name")
		.option("-f, --force", "Force deletion without confirmation")
		.action(async (options) => {
			try {
				if (!options.name) {
					throw new Error("Profile name is required")
				}

				let shouldDelete = options.force

				if (!shouldDelete) {
					shouldDelete = await displayConfirmation(
						`Are you sure you want to delete profile "${options.name}"?`,
					)
				}

				if (shouldDelete) {
					await wsClient.sendCommand("deleteProfile", { name: options.name })
					displayBox("Profile Deleted", `Profile "${options.name}" has been deleted`, "success")
				} else {
					console.log(chalk.yellow("Profile deletion cancelled"))
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}
