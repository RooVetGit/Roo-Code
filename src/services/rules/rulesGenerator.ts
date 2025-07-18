import * as fs from "fs/promises"
import * as path from "path"
import {
	generateRulesInstructions,
	ruleTypeDefinitions,
	RulesGenerationOptions,
	RuleInstruction,
} from "../../core/prompts/instructions/generate-rules"

/**
 * Creates a comprehensive task message for rules generation that can be used with initClineWithTask
 */
export async function createRulesGenerationTaskMessage(
	workspacePath: string,
	selectedRuleTypes: string[],
	addToGitignore: boolean,
	alwaysAllowWriteProtected: boolean = false,
	includeCustomRules: boolean = false,
	customRulesText: string = "",
): Promise<string> {
	// Only create directories if auto-approve is enabled
	if (alwaysAllowWriteProtected) {
		const directoriesToCreate = [
			path.join(workspacePath, ".roo", "rules"),
			path.join(workspacePath, ".roo", "rules-code"),
			path.join(workspacePath, ".roo", "rules-architect"),
			path.join(workspacePath, ".roo", "rules-debug"),
			path.join(workspacePath, ".roo", "rules-docs-extractor"),
		]

		for (const dir of directoriesToCreate) {
			try {
				await fs.mkdir(dir, { recursive: true })
			} catch (error) {
				// Directory might already exist, which is fine
			}
		}
	}

	// Create rule-specific instructions based on selected types
	const ruleInstructions: RuleInstruction[] = selectedRuleTypes
		.map((type) => {
			const definition = ruleTypeDefinitions[type as keyof typeof ruleTypeDefinitions]
			return definition || null
		})
		.filter((rule): rule is RuleInstruction => rule !== null)

	const options: RulesGenerationOptions = {
		selectedRuleTypes,
		addToGitignore,
		alwaysAllowWriteProtected,
		includeCustomRules,
		customRulesText,
	}

	return generateRulesInstructions(ruleInstructions, options)
}
