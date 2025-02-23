import { Anthropic } from "@anthropic-ai/sdk"
import fs from "fs/promises"
import * as path from "path"

function parseTimeToUnix(timeStr: string): string {
	// Match both formats:
	// "2/14/2025, 6:33:59 PM (America/Los_Angeles, UTC-8:00)"  // 12-hour
	// "2/14/2025, 18:33:59 (America/Los_Angeles, UTC-8:00)"    // 24-hour
	const match = timeStr.match(/^(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+):(\d+)(?:\s*(AM|PM))?\s*\(/)
	if (!match) {
		return timeStr
	}

	const [_, month, day, year, hour, minute, second, period] = match

	// Handle hours based on format
	let hours = parseInt(hour)
	if (period) {
		// 12-hour format
		if (period === "PM" && hours !== 12) {
			hours += 12
		}
		if (period === "AM" && hours === 12) {
			hours = 0
		}
	}
	// else: 24-hour format, use hours as-is

	try {
		const date = new Date(
			parseInt(year),
			parseInt(month) - 1, // months are 0-based
			parseInt(day),
			hours,
			parseInt(minute),
			parseInt(second),
		)
		return `UTC UNIX: ${Math.floor(date.getTime() / 1000)}`
	} catch (e) {
		return timeStr
	}
}

function hasEnvironmentDetails(message: Anthropic.Messages.MessageParam): boolean {
	if (!Array.isArray(message.content)) {
		return false
	}

	for (const block of message.content) {
		if (block.type === "text" && block.text.includes("<environment_details>")) {
			return true
		}
	}
	return false
}

function findLastEnvironmentMessage(messages: Anthropic.Messages.MessageParam[]): number {
	let lastIndex = -1
	for (let i = 0; i < messages.length; i++) {
		if (hasEnvironmentDetails(messages[i])) {
			lastIndex = i
		}
	}
	return lastIndex
}

function compressEnvironmentSection(
	text: string,
	isLastMessage: boolean,
	accumulatedMatches: Map<string, string>,
): string {
	// Match the entire text structure using DOTALL mode
	const fullMatch = text.match(/^(.*?)(<environment_details>\n)(.*?)(\n<\/environment_details>)(.*?)$/s)
	if (!fullMatch) {
		return text
	}

	const [_, beforeEnv, envStart, envContent, envEnd, afterEnv] = fullMatch

	if (isLastMessage) {
		console.log("Last Message Environment Details Before:", envContent)
	}

	function handleSection(heading: string, content: string, isLast: boolean): string {
		if (!isLast) {
			return ""
		}
		return `# ${heading}\n${content}\n`
	}

	function handleTimeSection(heading: string, content: string, isLast: boolean): string {
		if (isLast) {
			return `# ${heading}\n${content}\n`
		}
		return `# ${heading}\n${parseTimeToUnix(content.trim())}\n`
	}

	// Define sections with their headings
	const sectionMatches = [
		{ heading: "Current Working Directory \\([^)]+\\) Files", handle: handleSection },
		{ heading: "VSCode Visible Files", handle: handleSection },
		{ heading: "VSCode Open Tabs", handle: handleSection },
		{ heading: "Current Mode", handle: handleSection },
		{ heading: "Current Time", handle: handleTimeSection },
	]

	// Process each section
	let processedContent = envContent
	const patternEnd = "(?=\\n# |$)"

	for (const section of sectionMatches) {
		// Use DOTALL mode for section matching
		const regex = new RegExp(`\\n*#\\s*${section.heading}\\s*?\\n(.*?)${patternEnd}`, "s")
		const match = processedContent.match(regex)

		console.log(`Processing section "${section.heading}":`)
		console.log("- Regex pattern:", regex)
		console.log("- Match found:", !!match)
		if (match) {
			console.log("- Matched content:", match[0])
		}

		if (match) {
			// Found a match - accumulate it
			accumulatedMatches.set(section.heading, match[0])
			console.log(`- Added to accumulated matches: ${section.heading}\n  ${match[0]}`)

			if (!isLastMessage) {
				processedContent = processedContent.replace(regex, (match, content) =>
					section.handle(section.heading, content, false),
				)
				console.log("- Processed for non-last message")
			}
		} else if (isLastMessage && accumulatedMatches.has(section.heading)) {
			// No match in last message but we have accumulated content - append it
			processedContent += accumulatedMatches.get(section.heading)
		}
	}

	// Clean up newlines and reconstruct with regex
	processedContent = processedContent.replace(/\n{2,}/g, "\n")
	const result = beforeEnv + envStart + processedContent.trim() + envEnd + afterEnv

	if (isLastMessage) {
		console.log("Last Message Environment Details After:", result)
		console.log("Accumulated Matches (last):", Object.fromEntries(accumulatedMatches))
	}

	return result
}

export function compressEnvironmentDetails(messages: Anthropic.Messages.MessageParam[]): void {
	const lastEnvIndex = findLastEnvironmentMessage(messages)
	if (lastEnvIndex === -1) {
		console.warn("No <environment_details> were found in any message")
		return
	}

	const accumulatedMatches = new Map<string, string>()

	for (let i = 0; i < messages.length; i++) {
		if (!Array.isArray(messages[i].content) || messages[i].role !== "user") {
			continue
		}

		for (let j = 0; j < messages[i].content.length; j++) {
			const content = messages[i].content[j]
			if (typeof content === "string" || content.type !== "text") {
				continue
			}

			content.text = compressEnvironmentSection(content.text, i === lastEnvIndex, accumulatedMatches)
		}
	}
}

/**
 * Compresses conversation history by replacing duplicate content with references
 * and converting tool operations to more compact formats. Modifies messages in place.
 */
/**
 * Serializes message objects to pretty-printed JSON for debugging
 */
function serializeMessages(messages: Anthropic.Messages.MessageParam[]): string {
	return JSON.stringify(messages, null, 2)
}

/**
 * Compresses conversation history and returns the before/after message structures
 */
export function compressConversationHistory(
	messages: Anthropic.Messages.MessageParam[],
	taskId: string,
	beforeName?: string,
	afterName?: string,
): { before: string; after: string } {
	// Serialize messages BEFORE compression
	const beforeJson = serializeMessages(messages)

	// Compress environment details in place
	compressEnvironmentDetails(messages)

	// Serialize messages AFTER compression
	const afterJson = serializeMessages(messages)

	if (beforeName && afterName) {
		// beforeName and afterName are absolute paths
		const beforeDir = path.dirname(beforeName)
		const afterDir = path.dirname(afterName)

		// Create directories if they don't exist
		fs.mkdir(beforeDir, { recursive: true })
			.then(() => fs.mkdir(afterDir, { recursive: true }))
			.then(() => {
				fs.writeFile(beforeName, beforeJson)
				fs.writeFile(afterName, afterJson)

				console.log(`Compression debug files:
Before: ${beforeName}
After:  ${afterName}`)
			})
			.catch((err) => console.error("Error writing debug files:", err))
	}

	return {
		before: beforeJson,
		after: afterJson,
	}
}
