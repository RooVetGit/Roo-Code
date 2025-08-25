import { Command } from "./commands"

interface BuiltInCommandDefinition {
	name: string
	description: string
	argumentHint?: string
	content: string
}

const BUILT_IN_COMMANDS: Record<string, BuiltInCommandDefinition> = {
	init: {
		name: "init",
		description: "Initialize a project with recommended rules and configuration",
		content: `Please analyze this codebase and create an AGENTS.md file containing:
1. Build/lint/test commands - especially for running a single test
2. Code style guidelines including imports, formatting, types, naming conventions, error handling, etc.

Usage notes:
- The file you create will be given to agentic coding agents (such as yourself) that operate in this repository. Make it about 20 lines long.
- If there's already an AGENTS.md, improve it.
- If there are Claude Code rules (in CLAUDE.md), Cursor rules (in .cursor/rules/ or .cursorrules), or Copilot rules (in .github/copilot-instructions.md), make sure to include them.
- Be sure to prefix the file with the following text:

# AGENTS.md

This file provides guidance to agents when working with code in this repository.

Additionally, please:
1. **Create mode-specific rule directories** - Create directory structures for the four core modes: \`.roo/rules-code/\`, \`.roo/rules-ask/\`, \`.roo/rules-architect/\`, and \`.roo/rules-debug/\`
2. **Create mode-specific AGENTS.md files** - Within each of these four mode directories, research and then create an AGENTS.md file with rules specific to that mode's purpose and capabilities. These rules should provide additive context and not just repeat the mode definitions. Only include rules that you have high confidence are accurate, valuable, and non-obvious.

**For the complete list of available modes with detailed descriptions, refer to the system prompt.** The system prompt contains comprehensive information about each mode's purpose, when to use it, and its specific capabilities.

Example structure with specific instructions:

\\\`\\\`\\\`
AGENTS.md                    # General project guidance
.roo/
├── rules-code/
│   └── AGENTS.md           # Code mode specific instructions
├── rules-debug/
│   └── AGENTS.md           # Debug mode specific instructions
├── rules-ask/
│   └── AGENTS.md           # Ask mode specific instructions
└── rules-architect/
    └── AGENTS.md           # Architect mode specific instructions
\\\`\\\`\\\`

**Example project-specific instructions:**

**\`.roo/rules-code/AGENTS.md\`** - Project-specific coding rules:
\\\`\\\`\\\`
# Project Coding Rules

- All API calls must use the retry mechanism in src/api/providers/utils/
- UI components should use Tailwind CSS classes, not inline styles
- New providers must implement the Provider interface in packages/types/src/
- Database queries must use the query builder in packages/evals/src/db/queries/
- Always use safeWriteJson() from src/utils/ instead of JSON.stringify for file writes
- Test coverage required for all new features in src/ and webview-ui/
\\\`\\\`\\\`

**\`.roo/rules-debug/AGENTS.md\`** - Project-specific debugging approaches:
\\\`\\\`\\\`
# Project Debug Rules

- Check VSCode extension logs in the Debug Console
- For webview issues, inspect the webview dev tools via Command Palette
- Provider issues: check src/api/providers/__tests__/ for similar test patterns
- Database issues: run migrations in packages/evals/src/db/migrations/
- IPC communication issues: review packages/ipc/src/ message patterns
- Always reproduce in both development and production extension builds
\\\`\\\`\\\`

**\`.roo/rules-ask/AGENTS.md\`** - Project-specific explanation context:
\\\`\\\`\\\`
# Project Documentation Rules

- Reference the monorepo structure: src/ (VSCode extension), apps/ (web apps), packages/ (shared)
- Explain provider patterns by referencing existing ones in src/api/providers/
- For UI questions, reference webview-ui/ React components and their patterns
- Point to package.json scripts for build/test commands
- Reference locales/ for i18n patterns when discussing translations
- Always mention the VSCode webview architecture when discussing UI
\\\`\\\`\\\`

**\`.roo/rules-architect/AGENTS.md\`** - Project-specific architectural considerations:
\\\`\\\`\\\`
# Project Architecture Rules

- New features must work within VSCode extension + webview architecture
- Provider implementations must be stateless and cacheable
- UI state management uses React hooks, not external state libraries
- Database schema changes require migrations in packages/evals/src/db/migrations/
- New packages must follow the existing monorepo structure in packages/
- API changes must maintain backward compatibility with existing provider contracts
\\\`\\\`\\\`

This structure provides both general project guidance and specialized instructions for the four core modes' specific domains and workflows.
`,
	},
}

/**
 * Get all built-in commands as Command objects
 */
export async function getBuiltInCommands(): Promise<Command[]> {
	return Object.values(BUILT_IN_COMMANDS).map((cmd) => ({
		name: cmd.name,
		content: cmd.content,
		source: "built-in" as const,
		filePath: `<built-in:${cmd.name}>`,
		description: cmd.description,
		argumentHint: cmd.argumentHint,
	}))
}

/**
 * Get a specific built-in command by name
 */
export async function getBuiltInCommand(name: string): Promise<Command | undefined> {
	const cmd = BUILT_IN_COMMANDS[name]
	if (!cmd) return undefined

	return {
		name: cmd.name,
		content: cmd.content,
		source: "built-in" as const,
		filePath: `<built-in:${name}>`,
		description: cmd.description,
		argumentHint: cmd.argumentHint,
	}
}

/**
 * Get names of all built-in commands
 */
export async function getBuiltInCommandNames(): Promise<string[]> {
	return Object.keys(BUILT_IN_COMMANDS)
}
