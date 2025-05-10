import { CommandRiskLevel, commandRiskLevels } from "@roo-code/types"

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
