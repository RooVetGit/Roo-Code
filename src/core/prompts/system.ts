import * as fs from "fs"
import * as path from "path"
import {
	Mode,
	modes,
	CustomModePrompts,
	PromptComponent,
	defaultModeSlug,
	ModeConfig,
	getModeBySlug,
	getGroupName,
} from "../../shared/modes"
import { PromptVariables } from "./sections/custom-system-prompt"
import { DiffStrategy } from "../../shared/tools"
import { McpHub } from "../../services/mcp/McpHub"
import { getToolDescriptionsForMode } from "./tools"
import * as vscode from "vscode"
import * as os from "os"
import { renderEjs } from "./utils/renderEjs"

import {
	getSystemInfoSection,
	getSharedToolUseSection,
	getMcpServersSection,
	getToolUseGuidelinesSection,
	getModesSection,
	addCustomInstructions,
	markdownFormattingSection,
} from "./sections"
import { loadSystemPromptFile } from "./sections/custom-system-prompt"
import { formatLanguage } from "../../shared/language"

// Helper to render section content with common variables
type SectionName = keyof Pick<
	PromptComponent,
	"objectiveSectionOverride" | "rulesSectionOverride" | "capabilitiesSectionOverride"
>
type Templates = { objectiveTemplate: string; rulesTemplate: string; capabilitiesTemplate: string }
type RenderVars = { cwd: string; supportsComputerUse: boolean; diffStrategy?: DiffStrategy; mcpHub?: McpHub }

const renderSection = (
	section: SectionName,
	config: ModeConfig,
	pc: PromptComponent | undefined,
	template: string,
	vars: RenderVars,
) =>
	renderEjs(pc?.[section] ?? config[section] ?? template, {
		...vars,
		mcpHub: !!vars.mcpHub,
	})

function renderSectionContent(
	config: ModeConfig,
	pc: PromptComponent | undefined,
	templates: Templates,
	vars: RenderVars,
) {
	try {
		return {
			objectiveContent: renderSection("objectiveSectionOverride", config, pc, templates.objectiveTemplate, vars),
			rulesContent: renderSection("rulesSectionOverride", config, pc, templates.rulesTemplate, vars),
			capabilitiesContent: renderSection(
				"capabilitiesSectionOverride",
				config,
				pc,
				templates.capabilitiesTemplate,
				vars,
			),
		}
	} catch (error) {
		throw new Error(`Failed to render section content: ${error.message}`)
	}
}

// Load default Pug templates
function loadTemplates(context: vscode.ExtensionContext) {
	const templatesPath = path.join(context.extensionPath, "dist", "templates")
	return {
		objectiveTemplate: fs.readFileSync(path.join(templatesPath, "objective.ejs"), "utf8"),
		rulesTemplate: fs.readFileSync(path.join(templatesPath, "rules.ejs"), "utf8"),
		capabilitiesTemplate: fs.readFileSync(path.join(templatesPath, "capabilities.ejs"), "utf8"),
	}
}

async function generatePrompt(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	// Get the full mode config to ensure we have the role definition
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const roleDefinition = promptComponent?.roleDefinition || modeConfig.roleDefinition

	// Load templates and render sections
	const templates = loadTemplates(context)
	const { objectiveContent, rulesContent, capabilitiesContent } = renderSectionContent(
		modeConfig,
		promptComponent,
		templates,
		{
			cwd,
			supportsComputerUse,
			diffStrategy: effectiveDiffStrategy,
			mcpHub,
		},
	)

	const [modesSection, mcpServersSection] = await Promise.all([
		getModesSection(context),
		modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)
			: Promise.resolve(""),
	])

	const basePrompt = `${roleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(
	mode,
	cwd,
	supportsComputerUse,
	effectiveDiffStrategy,
	browserViewportSize,
	mcpHub,
	customModeConfigs,
	experiments,
)}

${getToolUseGuidelinesSection()}

${mcpServersSection}

${capabilitiesContent}

${modesSection}

${rulesContent}

${getSystemInfoSection(cwd)}

${objectiveContent}

${await addCustomInstructions(promptComponent?.customInstructions || modeConfig.customInstructions || "", globalCustomInstructions || "", cwd, mode, { language: language ?? formatLanguage(vscode.env.language), rooIgnoreInstructions })}`

	return basePrompt
}

export const SYSTEM_PROMPT = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mode: Mode = defaultModeSlug,
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	const getPromptComponent = (value: unknown) => {
		if (typeof value === "object" && value !== null) {
			return value as PromptComponent
		}
		return undefined
	}

	// Try to load custom system prompt from file
	const variablesForPrompt: PromptVariables = {
		workspace: cwd,
		mode: mode,
		language: language ?? formatLanguage(vscode.env.language),
		shell: vscode.env.shell,
		operatingSystem: os.type(),
	}
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)

	// Check if it's a custom mode
	const promptComponent = getPromptComponent(customModePrompts?.[mode])

	// Get full mode config from custom modes or fall back to built-in modes
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	// If a file-based custom system prompt exists, use it
	if (fileCustomSystemPrompt) {
		// If diff is disabled, don't pass the diffStrategy
		const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined
		const roleDefinition = promptComponent?.roleDefinition || currentMode.roleDefinition

		// Load templates and render sections
		const templates = loadTemplates(context)
		const { objectiveContent, rulesContent, capabilitiesContent } = renderSectionContent(
			currentMode,
			promptComponent,
			templates,
			{
				cwd,
				supportsComputerUse,
				diffStrategy: effectiveDiffStrategy,
				mcpHub,
			},
		)

		const customInstructions = await addCustomInstructions(
			promptComponent?.customInstructions || currentMode.customInstructions || "",
			globalCustomInstructions || "",
			cwd,
			mode,
			{ language: language ?? formatLanguage(vscode.env.language), rooIgnoreInstructions },
		)

		// For file-based prompts, include the overrideable sections after the custom prompt
		return `${roleDefinition}

${fileCustomSystemPrompt}

${objectiveContent}

${capabilitiesContent}

${rulesContent}

${customInstructions}`
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	return generatePrompt(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		effectiveDiffStrategy,
		browserViewportSize,
		promptComponent,
		customModes,
		globalCustomInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
	)
}
