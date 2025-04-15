import boxen, { Options } from "boxen"
import chalk from "chalk"
import prompts from "prompts"

/**
 * Display a message in a collapsible box
 * @param title The title of the box
 * @param content The content to display
 * @param type The type of message (info, success, error, warning)
 */
export function displayBox(
	title: string,
	content: string,
	type: "info" | "success" | "error" | "warning" = "info",
): void {
	let titleColor: chalk.Chalk
	// Define borderColor as a string type since boxen accepts color names
	let borderColor: string

	switch (type) {
		case "success":
			titleColor = chalk.green.bold
			borderColor = "green"
			break
		case "error":
			titleColor = chalk.red.bold
			borderColor = "red"
			break
		case "warning":
			titleColor = chalk.yellow.bold
			borderColor = "yellow"
			break
		case "info":
		default:
			titleColor = chalk.blue.bold
			borderColor = "blue"
			break
	}

	const boxTitle = titleColor(title)

	const boxOptions: Options = {
		padding: 1,
		margin: 1,
		borderStyle: "round",
		borderColor: borderColor,
		title: boxTitle,
		titleAlignment: "center",
	}

	console.log(boxen(content, boxOptions))
}

/**
 * Display an interactive prompt for the user to select from options
 * @param message The message to display
 * @param choices The choices to display
 * @returns The selected choice
 */
export async function displayPrompt(message: string, choices: string[]): Promise<string> {
	const response = await prompts({
		type: "select",
		name: "value",
		message,
		choices: choices.map((choice) => ({ title: choice, value: choice })),
		initial: 0,
	})

	return response.value
}

/**
 * Display a confirmation prompt
 * @param message The message to display
 * @returns True if confirmed, false otherwise
 */
export async function displayConfirmation(message: string): Promise<boolean> {
	const response = await prompts({
		type: "confirm",
		name: "value",
		message,
		initial: false,
	})

	return response.value
}

/**
 * Display a text input prompt
 * @param message The message to display
 * @param initialValue The initial value
 * @returns The entered text
 */
export async function displayTextInput(message: string, initialValue: string = ""): Promise<string> {
	const response = await prompts({
		type: "text",
		name: "value",
		message,
		initial: initialValue,
	})

	return response.value
}

/**
 * Format streaming text for display
 * @param text The text to format
 * @returns The formatted text
 */
export function formatStreamingText(text: string): string {
	return text.trim()
}

/**
 * Display configurations in a concise format
 * @param title The title of the box
 * @param configs The configurations to display
 */
export function displayConfigConcise(title: string, configs: any): void {
	if (!configs || Object.keys(configs).length === 0) {
		displayBox(title, "No configurations found", "info")
		return
	}

	const lines = Object.entries(configs).map(([key, config]: [string, any]) => {
		const apiProvider = config.apiProvider || "unknown"
		return `${key}: ${apiProvider}`
	})

	displayBox(title, lines.join("\n"), "info")
}

/**
 * Display configurations in a concise format with the ability to expand individual configurations
 * @param title The title of the box
 * @param configs The configurations to display
 */
export async function displayConfigExpandable(title: string, configs: any): Promise<void> {
	if (!configs || Object.keys(configs).length === 0) {
		displayBox(title, "No configurations found", "info")
		return
	}

	// Display concise view first
	const lines = Object.entries(configs).map(([key, config]: [string, any]) => {
		const apiProvider = config.apiProvider || "unknown"
		return `${key}: ${apiProvider}`
	})

	displayBox(title, lines.join("\n"), "info")

	// Ask if user wants to expand any configuration
	const shouldExpand = await displayConfirmation("Would you like to view the full details of any configuration?")

	if (shouldExpand) {
		const configNames = Object.keys(configs)
		const selectedConfig = await displayPrompt("Select a configuration to view:", configNames)

		if (selectedConfig && configs[selectedConfig]) {
			displayBox(`Configuration: ${selectedConfig}`, JSON.stringify(configs[selectedConfig], null, 2), "info")
		}
	}
}
