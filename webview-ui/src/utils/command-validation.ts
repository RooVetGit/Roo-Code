import { parse } from 'shell-quote'

/**
 * Represents a token from shell-quote parsing
 * Can be either a string literal, an operator, or a command
 */
type ShellToken = string | { op: string; type?: string } | { command: string; type?: string }

/**
 * Split a command string into individual sub-commands by
 * chaining operators (&&, ||, ;, or |).
 *
 * Uses shell-quote to properly handle:
 * - Quoted strings (preserves quotes)
 * - Subshell commands ($(cmd) or `cmd`)
 * - PowerShell redirections (2>&1)
 * - Chain operators (&&, ||, ;, |)
 *
 * @param command - The command string to parse
 * @returns An array of individual command strings
 */
export function parseCommand(command: string): string[] {
  if (!command?.trim()) return []

  // First handle PowerShell redirections by temporarily replacing them
  const redirections: string[] = []
  let processedCommand = command.replace(/\d*>&\d*/g, (match) => {
    redirections.push(match)
    return `__REDIR_${redirections.length - 1}__`
  })

  // Handle subshell commands
  const subshells: string[] = []
  const processSubshells = (cmd: string): string => {
    return cmd
      .replace(/\$\(([^)(]*(?:\([^)(]*\)[^)(]*)*)\)/g, (_, inner) => {
        subshells.push(inner.trim())
        return '' // Remove the subshell command from the main command
      })
      .replace(/`([^`]*)`/g, (_, inner) => {
        subshells.push(inner.trim())
        return '' // Remove the subshell command from the main command
      })
  }
  processedCommand = processSubshells(processedCommand)
  // Clean up any double spaces created by removing subshells
  processedCommand = processedCommand.replace(/\s+/g, ' ').trim()

  // Then handle quoted strings
  const quotes: string[] = []
  processedCommand = processedCommand.replace(/"[^"]*"/g, (match) => {
    quotes.push(match)
    return `__QUOTE_${quotes.length - 1}__`
  })

  const tokens = parse(processedCommand) as ShellToken[]
  const commands: string[] = []
  let currentCommand: string[] = []

  for (const token of tokens) {
    if (typeof token === 'object' && 'op' in token) {
      if (['&&', '||', ';', '|'].includes(token.op)) {
        if (currentCommand.length > 0) {
          commands.push(currentCommand.join(' '))
          currentCommand = []
        }
      } else {
        currentCommand.push(token.op)
      }
    } else if (typeof token === 'string') {
      currentCommand.push(token)
    }
  }

  if (currentCommand.length > 0) {
    commands.push(currentCommand.join(' '))
  }

  // Restore quotes and redirections
  const finalCommands = commands.map((cmd) => {
    let result = cmd
    result = result.replace(/__QUOTE_(\d+)__/g, (_, i) => quotes[parseInt(i, 10)])
    result = result.replace(/__REDIR_(\d+)__/g, (_, i) => redirections[parseInt(i, 10)])
    return result
  })

  // Process subshell commands recursively
  const subshellCommands = subshells.reduce((acc: string[], subCmd) => {
    const nestedCommands = parseCommand(subCmd)
    return [...acc, ...nestedCommands]
  }, [])

  // Return all commands including subshell commands
  return [...finalCommands, ...subshellCommands]
}

/**
 * Check if a single command is allowed based on prefix matching.
 *
 * @param command - The command string to validate
 * @param allowedCommands - Array of allowed command prefixes
 * @returns boolean indicating if the command is allowed
 */
export function isAllowedSingleCommand(
  command: string,
  allowedCommands: string[]
): boolean {
  if (!command || !allowedCommands?.length) return false
  const trimmedCommand = command.trim().toLowerCase()
  return allowedCommands.some(prefix =>
    trimmedCommand.startsWith(prefix.toLowerCase())
  )
}

/**
 * Check if a command string is allowed based on the allowed command prefixes.
 * This version validates both main commands and subshell commands.
 *
 * @param command - The command string to validate
 * @param allowedCommands - Array of allowed command prefixes
 * @returns boolean indicating if all commands in the string are allowed
 */
export function validateCommand(command: string, allowedCommands: string[]): boolean {
  if (!command?.trim()) return true

  // Get all commands including subshell commands
  const allCommands = parseCommand(command)

  // Validate each command
  return allCommands.every((cmd: string) => {
    const cmdWithoutRedirection = cmd.replace(/\d*>&\d*/, '').trim()

    // Check if this is a subshell command that needs further parsing
    if (cmdWithoutRedirection.includes('$(') || cmdWithoutRedirection.includes('`')) {
      return validateCommand(cmdWithoutRedirection, allowedCommands)
    }

    return isAllowedSingleCommand(cmdWithoutRedirection, allowedCommands)
  })
}
