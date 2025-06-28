import { z } from "zod"

/**
 * CommandExecutionStatus
 */

export const commandExecutionStatusSchema = z.discriminatedUnion("status", [
	z.object({
		executionId: z.string(),
		status: z.literal("started"),
		pid: z.number().optional(),
		command: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("output"),
		output: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("exited"),
		exitCode: z.number().optional(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("fallback"),
	}),
])

export type CommandExecutionStatus = z.infer<typeof commandExecutionStatusSchema>

/**
 * CommandRiskLevel
 */

export const commandRiskLevels = [
	"disabled",
	"none",
	"readOnly",
	"reversibleChanges",
	"complexChanges",
	"serviceInterruptingChanges",
	"destructiveChanges",
] as const

export const commandRiskLevelsSchema = z.enum(commandRiskLevels)

export type CommandRiskLevel = z.infer<typeof commandRiskLevelsSchema>

/**
 * Command Risk Utility Functions
 */

/**
 * Helper function to check if risk analysis is enabled based on commandRiskLevel
 * @param commandRiskLevel The command risk level
 * @returns true if risk analysis is enabled, false otherwise
 */
export function isRiskAnalysisEnabled(commandRiskLevel?: CommandRiskLevel): boolean {
	// Risk analysis is enabled by default and only disabled when commandRiskLevel is explicitly "disabled"
	return commandRiskLevel !== undefined && commandRiskLevel !== "disabled"
}

/**
 * Function to validate if a risk level is valid
 * @param risk The risk level to validate
 * @returns true if the risk level is valid, false otherwise
 */
export function isValidRiskLevel(risk: string): boolean {
	return (
		risk !== undefined &&
		risk !== "none" &&
		risk !== "disabled" &&
		commandRiskLevels.includes(risk as CommandRiskLevel)
	)
}

/**
 * Function to check if a command risk level is allowed based on the user's risk level setting
 * @param userRiskLevel The user's risk level setting
 * @param cmdRiskLevel The command's risk level
 * @returns true if the command risk level is allowed, false otherwise
 */
export function isRiskAllowed(userRiskLevel: CommandRiskLevel, cmdRiskLevel: CommandRiskLevel): boolean {
	if (userRiskLevel === "none") return false
	const userRiskIndex = commandRiskLevels.indexOf(userRiskLevel)
	const cmdRiskIndex = commandRiskLevels.indexOf(cmdRiskLevel)
	return cmdRiskIndex <= userRiskIndex
}
