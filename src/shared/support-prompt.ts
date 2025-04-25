// Support prompts
type PromptParams = Record<string, string | any[]>

const generateDiagnosticText = (diagnostics?: any[]) => {
	if (!diagnostics?.length) return ""
	return `\nCurrent problems detected:\n${diagnostics
		.map((d) => `- [${d.source || "Error"}] ${d.message}${d.code ? ` (${d.code})` : ""}`)
		.join("\n")}`
}

export const createPrompt = (template: string, params: PromptParams): string => {
	return template.replace(/\${(.*?)}/g, (_, key) => {
		if (key === "diagnosticText") {
			return generateDiagnosticText(params["diagnostics"] as any[])
		} else if (params.hasOwnProperty(key)) {
			// Ensure the value is treated as a string for replacement
			const value = params[key]
			if (typeof value === "string") {
				return value
			} else {
				// Convert non-string values to string for replacement
				return String(value)
			}
		} else {
			// If the placeholder key is not in params, replace with empty string
			return ""
		}
	})
}

interface SupportPromptConfig {
	template: string
}

const supportPromptConfigs: Record<string, SupportPromptConfig> = {
	ENHANCE: {
		template: `Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):

\${userInput}`,
	},
	EXPLAIN: {
		template: `Explain the following code from file path \${filePath}: (line: \${startLine}-\${endLine})
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please provide a clear and concise explanation of what this code does, including:
1. The purpose and functionality
2. Key components and their interactions
3. Important patterns or techniques used`,
	},
	FIX: {
		template: `Fix any issues in the following code from file path \${filePath}: (line: \${startLine}-\${endLine})
\${diagnosticText}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please:
1. Address all detected problems listed above (if any)
2. Identify any other potential bugs or issues
3. Provide corrected code
4. Explain what was fixed and why`,
	},
	COMPLETE: {
		template: `Complete the selected code block \${filePath}: (line: \${startLine}-\${endLine})

\`\`\`
\${selectedText}
\`\`\`

Please pay attention to the following:
1. the user's design approach
2. the purpose and functionality of the code block to be completed
3. the logical structure of the code
4. The comments and pseudocode which the user may have written (if any):
 - Pseudocode may use abbreviated or shorthand forms of types, variables, function names
 - Pseudocode may contain unusual syntax order
5. existing context variables, input parameters, and dependencies that must be correctly utilized
6. output values, return types, and new variables that subsequent code will depend on

You should only insert or modify code at the user-specified location. Other parts of the code should not be modified.(You can give your suggestions in the other parts of the code, but do not modify them directly)`,
	},
	ASK_FOR_HELP: {
		template: `
\${filePath}: (line: \${startLine}-\${endLine})
\${diagnosticText}
\`\`\`
\${selectedText}
\`\`\`
User request is:
\${userInput}

If user ask for fix any issues, you should:
1. Address all detected problems listed above (if any)
2. Identify any other potential bugs or issues
3. Provide corrected code
4. Explain what was fixed and why

If user ask for explain some code, you should provide a clear and concise explanation of what this code does, including:
1. The purpose and functionality
2. Key components and their interactions
3. Important patterns or techniques used

If user ask for improve some code, you should suggest improvements for:
1. Code readability and maintainability
2. Performance optimization
3. Best practices and patterns
4. Error handling and edge cases
* Provide the improved code along with explanations for each enhancement.

If the user asks you to complete code or insert code, you need to consider the following:
1. The user's design approach, the purpose and functionality of the code block to be completed, and the logical structure of the code
2. Known context variables
3. Variables to be defined for future use
* The user's pseudocode may use abbreviated or shorthand forms of types, variables, function names.
* The user's pseudocode may contain unusual syntax order.


For other situations, please provide relevant responses based on the user's request.
`,
	},
	IMPROVE: {
		template: `Improve the following code from file path \${filePath}: (line: \${startLine}-\${endLine})
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please suggest improvements for:
1. Code readability and maintainability
2. Performance optimization
3. Best practices and patterns
4. Error handling and edge cases

Provide the improved code along with explanations for each enhancement.`,
	},
	ADD_TO_CONTEXT: {
		template: `\${filePath}: (line: \${startLine}-\${endLine})
\`\`\`
\${selectedText}
\`\`\`\n`,
	},
	TERMINAL_ADD_TO_CONTEXT: {
		template: `\${userInput}
Terminal output:
\`\`\`
\${terminalContent}
\`\`\``,
	},
	TERMINAL_FIX: {
		template: `\${userInput}
Fix this terminal command:
\`\`\`
\${terminalContent}
\`\`\`

Please:
1. Identify any issues in the command
2. Provide the corrected command
3. Explain what was fixed and why`,
	},
	TERMINAL_EXPLAIN: {
		template: `\${userInput}
Explain this terminal command:
\`\`\`
\${terminalContent}
\`\`\`

Please provide:
1. What the command does
2. Explanation of each part/flag
3. Expected output and behavior`,
	},
	NEW_TASK: {
		template: `\${userInput}`,
	},
} as const

type SupportPromptType = keyof typeof supportPromptConfigs

export const supportPrompt = {
	default: Object.fromEntries(Object.entries(supportPromptConfigs).map(([key, config]) => [key, config.template])),
	get: (customSupportPrompts: Record<string, any> | undefined, type: SupportPromptType): string => {
		return customSupportPrompts?.[type] ?? supportPromptConfigs[type].template
	},
	create: (type: SupportPromptType, params: PromptParams, customSupportPrompts?: Record<string, any>): string => {
		const template = supportPrompt.get(customSupportPrompts, type)
		return createPrompt(template, params)
	},
} as const

export type { SupportPromptType }

export type CustomSupportPrompts = {
	[key: string]: string | undefined
}
