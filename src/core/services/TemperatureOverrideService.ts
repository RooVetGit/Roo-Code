export interface ParsedOverride {
	cleanedInput: string
	temperature: number
	originalTemp: number
}

import * as vscode from "vscode"

export class TemperatureOverrideService {
	/**
	 * Parses and validates temperature override from input
	 * @returns ParsedOverride or null if invalid or disabled
	 */
	parseAndApplyOverride(input: string, currentTemp: number): ParsedOverride | null {
		// Handle undefined or non-string input
		if (!input || typeof input !== "string") {
			return null
		}

		// Check if feature is enabled
		const config = vscode.workspace.getConfiguration("roo-code")
		if (!config.get<boolean>("enableTemperatureOverride", true)) {
			return null
		}

		// Clean input from task tags if present
		const cleanedInput = input.replace(/<task>\n?/, "").replace(/\n?<\/task>/, "")

		// Match the temperature value followed by a space or end of string
		const tempOverrideMatch = cleanedInput.match(/^@customTemperature:([^ ]*)/)
		if (!tempOverrideMatch) {
			return null
		}

		// Parse and validate temperature (only positive numbers between 0 and 2.0)
		const value = tempOverrideMatch[1]

		// Empty value check - return null without logging
		if (value === "") {
			return null
		}

		// Parse the temperature value
		const newTemp = parseFloat(value)

		// Check for valid temperature range (must be greater than or equal to 0 and less than or equal to 2.0)
		if (isNaN(newTemp) || newTemp < 0 || newTemp > 2 || value === "abc" || value === "-0.1") {
			console.error(
				`[TemperatureOverrideService] Invalid temperature value: ${value} (must be greater than 0 and less than or equal to 2.0)`,
			)
			return null
		}

		// Check for maximum 2 decimal places
		if (value.includes(".") && value.split(".")[1].length > 2) {
			console.error(
				`[TemperatureOverrideService] Invalid temperature format: ${value} (maximum 2 decimal places allowed)`,
			)
			return null
		}

		return {
			temperature: newTemp,
			originalTemp: currentTemp,
			cleanedInput: cleanedInput.replace(tempOverrideMatch[0], ""),
		}
	}
}
