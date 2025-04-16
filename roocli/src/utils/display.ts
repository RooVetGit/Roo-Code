import boxen, { Options } from "boxen"
import chalk from "chalk"
import prompts from "prompts"

/**
 * Interface for the followup question structure
 */
interface FollowupQuestion {
	question: string
	suggest: string[]
}

/**
 * Display a message in a collapsible box
 * @param title The title of the box
 * @param content The content to display
 * @param type The type of message (info, success, error, warning)
 */
// ANSI escape codes for mouse handling
const ENABLE_MOUSE_TRACKING = "\x1b[?1000h" // Enable mouse click tracking
const DISABLE_MOUSE_TRACKING = "\x1b[?1000l" // Disable mouse click tracking

/**
 * Display a message in a collapsible box
 * @param title The title of the box
 * @param content The content to display
 * @param type The type of message (info, success, error, warning)
 * @param collapsible Whether the box should be collapsible
 */
export function displayBox(
	title: string,
	content: string,
	type: "info" | "success" | "error" | "warning" = "info",
	collapsible: boolean = true, // Make all boxes collapsible by default
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

	// Create box options
	const boxOptions: Options = {
		padding: 1,
		margin: 1,
		borderStyle: "round",
		borderColor: borderColor,
		title: titleColor(title),
		titleAlignment: "center",
	}

	// Create the full box content
	const boxContent = boxen(content, boxOptions)

	// Start with collapsed state by default for all boxes
	let isCollapsed = true

	if (collapsible) {
		// Show collapsed version with [+] indicator
		console.log(titleColor(`${title} [+]`))

		// Add a hint about expanding
		console.log(chalk.gray("Click to expand"))
	} else {
		// If not collapsible, show the full box immediately
		console.log(boxContent)
	}
}

/**
 * Display a message in a collapsible box with checkpoint information
 * @param title The title of the box
 * @param content The content to display
 * @param type The type of message (info, success, error, warning)
 */
export function displayCollapsibleBox(
	title: string,
	content: string,
	type: "info" | "success" | "error" | "warning" = "info",
): void {
	displayBox(title, content, type, true)
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

/**
 * Display a followup question with suggested answers and allow the user to select one
 * @param followupQuestion The followup question with suggested answers
 * @param additionalMessage Optional additional message to append to the selected suggestion
 * @returns The selected suggestion with optional additional message
 */
export async function displayFollowupQuestion(
	followupQuestion: FollowupQuestion,
	additionalMessage?: string,
): Promise<string> {
	// Display the question
	console.log(chalk.blue("\nQuestion:"), followupQuestion.question)

	// Display the suggested answers
	console.log(chalk.blue("\nSuggested answers:"))
	followupQuestion.suggest.forEach((suggestion: string, index: number) => {
		console.log(`${chalk.green(index + 1 + ".")} ${suggestion}`)
	})

	// Prompt the user to select an answer
	const response = await prompts({
		type: "select",
		name: "value",
		message: "Select an answer:",
		choices: followupQuestion.suggest.map((suggestion: string, index: number) => ({
			title: `${index + 1}. ${suggestion}`,
			value: index,
		})),
		initial: 0,
	})

	// Get the selected suggestion
	const selectedSuggestion = followupQuestion.suggest[response.value]

	// If there's an additional message, append it to the selected suggestion
	if (additionalMessage) {
		return `${selectedSuggestion}\n${additionalMessage}`
	}

	return selectedSuggestion
}

/**
 * Display suggested answers and allow the user to select one
 * @param askMessage The ask type message with question and suggestions
 * @param additionalMessage Optional additional message to append to the selected suggestion
 * @returns The selected suggestion with optional additional message
 */
export async function displaySuggestedAnswers(
	askMessage: { question: string; suggest: string[] },
	additionalMessage?: string,
): Promise<string> {
	// Display the question
	console.log(chalk.blue("\nQuestion:"), askMessage.question)

	// Display the suggested answers
	console.log(chalk.blue("\nSuggested answers:"))
	askMessage.suggest.forEach((suggestion, index) => {
		console.log(`${chalk.green(index + 1 + ".")} ${suggestion}`)
	})

	// Prompt the user to select an answer
	const response = await prompts({
		type: "select",
		name: "value",
		message: "Select an answer:",
		choices: askMessage.suggest.map((suggestion, index) => ({
			title: `${index + 1}. ${suggestion}`,
			value: index,
		})),
		initial: 0,
	})

	// Get the selected suggestion
	const selectedSuggestion = askMessage.suggest[response.value]

	// If there's an additional message, append it to the selected suggestion
	if (additionalMessage) {
		return `${selectedSuggestion}\n${additionalMessage}`
	}

	return selectedSuggestion
}
