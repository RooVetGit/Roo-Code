import { CommandRiskLevel } from "../../../src/schemas"

// Re-implement the risk validation functions that were being imported from the extension code
export const commandRiskLevels: CommandRiskLevel[] = [
	"none",
	"readOnly",
	"reversibleChanges",
	"complexChanges",
	"serviceInterruptingChanges",
	"destructiveChanges",
]

// Function to validate risk level
export const isValidRiskLevel = (risk: string): boolean => {
	return risk !== undefined && risk !== "none" && commandRiskLevels.includes(risk as CommandRiskLevel)
}

// Function to check if risk is allowed
export const isRiskAllowed = (userRiskLevel: CommandRiskLevel, cmdRiskLevel: CommandRiskLevel): boolean => {
	if (userRiskLevel === "none") return false
	const userRiskIndex = commandRiskLevels.indexOf(userRiskLevel)
	const cmdRiskIndex = commandRiskLevels.indexOf(cmdRiskLevel)
	return cmdRiskIndex <= userRiskIndex
}
