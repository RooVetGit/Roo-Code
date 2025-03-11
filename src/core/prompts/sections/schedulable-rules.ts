/***********************************************
 * FILE: schedulable-rules.ts
 * CREATED: 2025-03-11 03:16:11
 *
 * CHANGELOG:
 * - 2025-03-11 03:16:11: (Schedulable Rules - Implementation) Initial implementation with parseTimeInterval, SchedulableRule interface, and SchedulableRulesManager class
 * - 2025-03-11 03:16:58: (Schedulable Rules - Implementation) Fixed TypeScript errors related to imports and type annotations
 * - 2025-03-11 06:30:00: (Schedulable Rules - Persistence) Added persistence for rule execution times using VSCode global state
 * - 2025-03-11 06:36:30: (Schedulable Rules - Async) Fixed async handling for non-awaited markRuleAsExecuted calls
 *
 * PURPOSE:
 * This file handles loading and management of time-based rule files (.clinerules-5m, etc.)
 * that are executed on a schedule and appended to the system prompt.
 *
 * METHODS:
 * - parseTimeInterval(): Parses time intervals from filenames
 * - SchedulableRulesManager.constructor(): Initializes a new rules manager
 * - SchedulableRulesManager.setContext(): Sets the VSCode extension context for state persistence
 * - SchedulableRulesManager.loadExecutionTimes(): Loads execution times from global state
 * - SchedulableRulesManager.saveExecutionTimes(): Saves execution times to global state
 * - SchedulableRulesManager.resetAllRules(): Resets all rule execution times
 * - SchedulableRulesManager.loadSchedulableRules(): Loads all schedulable rules from a directory
 * - SchedulableRulesManager.shouldExecuteRule(): Checks if a rule should be executed
 * - SchedulableRulesManager.markRuleAsExecuted(): Marks a rule as executed
 * - SchedulableRulesManager.getExecutableRules(): Gets rules that should be executed
 * - SchedulableRulesManager.getAllRules(): Gets all rules with their status for UI display
 ***********************************************/

import * as path from "path"
import * as fs from "fs/promises"
import * as vscode from "vscode"
import { logger } from "../../../utils/logging"

/**
 * Interface representing a schedulable rule
 */
export interface SchedulableRule {
	filePath: string
	fileName: string
	interval: number // in milliseconds
	timeUnit: string // 's', 'm', 'h', 'd'
	displayInterval: string // Human readable (e.g., "5 minutes")
	content: string
	lastExecuted: number
}

/**
 * Time unit conversion mapping
 */
const TIME_UNITS = {
	s: { ms: 1000, name: "second" },
	m: { ms: 60 * 1000, name: "minute" },
	h: { ms: 60 * 60 * 1000, name: "hour" },
	d: { ms: 24 * 60 * 60 * 1000, name: "day" },
} as const

type TimeUnit = keyof typeof TIME_UNITS

/**
 * Parse time component from file name (e.g., "5m" => 300000ms)
 * @param timeStr - The time string to parse (e.g., "5m", "10s", "1h", "1d")
 * @returns Object containing the interval in milliseconds, unit, and display string
 * @throws Error if the time format is invalid
 */
export function parseTimeInterval(timeStr: string): { interval: number; unit: string; display: string } {
	// Match pattern like "5m", "10s", "1h", "1d"
	const match = timeStr.match(/^(\d+)([smhd])$/)
	if (!match) {
		throw new Error(`Invalid time format: ${timeStr}. Expected format: e.g., "5m", "10s", "1h", "1d"`)
	}

	const value = parseInt(match[1], 10)
	const unit = match[2] as TimeUnit

	const intervalMs = value * TIME_UNITS[unit].ms
	const unitName = TIME_UNITS[unit].name
	const display = `${value} ${unitName}${value !== 1 ? "s" : ""}`

	return {
		interval: intervalMs,
		unit,
		display,
	}
}

/**
 * Manager for schedulable rule files
 */
export class SchedulableRulesManager {
	private lastExecutionTimes: Map<string, number> = new Map()
	private context: vscode.ExtensionContext | null = null
	private outputChannel: vscode.OutputChannel | null = null
	private readonly STORAGE_KEY = "schedulableRules.lastExecutionTimes"

	/**
	 * Create a new SchedulableRulesManager
	 */
	constructor() {
		logger.info("SchedulableRulesManager initialized")
	}

	/**
	 * Set the extension context for persistence
	 * @param context - VSCode extension context
	 */
	public setContext(context: vscode.ExtensionContext): void {
		this.context = context
		this.loadExecutionTimes()
		logger.debug("SchedulableRulesManager context set")
		this.log("debug", "SchedulableRulesManager context set")
	}

	/**
	 * Set the output channel for logging
	 * @param outputChannel - VSCode output channel
	 */
	public setOutputChannel(outputChannel: vscode.OutputChannel): void {
		this.outputChannel = outputChannel
		this.log("info", "SchedulableRulesManager output channel set")
	}

	/**
	 * Log a message to both the outputChannel (if available) and the logger
	 * @param level - Log level
	 * @param message - Message to log
	 */
	private log(level: "debug" | "info" | "warn" | "error", message: string): void {
		// Add timestamp for better time tracking
		const timestamp = new Date().toLocaleTimeString()
		const formattedMessage = `[${timestamp}] [SchedulableRules] ${message}`

		// Always show output channel when logging
		if (this.outputChannel) {
			this.outputChannel.appendLine(formattedMessage)

			// Show the output panel for important messages
			if (level === "info" || level === "warn" || level === "error") {
				if (typeof this.outputChannel.show === "function") {
					this.outputChannel.show(true)
				}
			}
		}

		// Also log to the regular logger for completeness
		switch (level) {
			case "debug":
				if (typeof logger.debug === "function") logger.debug(message)
				break
			case "info":
				if (typeof logger.info === "function") logger.info(message)
				break
			case "warn":
				if (typeof logger.warn === "function") logger.warn(message)
				break
			case "error":
				if (typeof logger.error === "function") logger.error(message)
				break
		}
	}

	/**
	 * Load execution times from global state
	 */
	private loadExecutionTimes(): void {
		if (!this.context) {
			this.log("warn", "Cannot load execution times: context not set")
			return
		}

		try {
			const savedTimes = this.context.globalState.get<Record<string, number>>(this.STORAGE_KEY)
			if (savedTimes) {
				this.lastExecutionTimes = new Map(Object.entries(savedTimes))
				this.log("debug", `Loaded ${this.lastExecutionTimes.size} rule execution times from storage`)
			}
		} catch (err) {
			this.log("error", `Failed to load execution times: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	/**
	 * Save execution times to global state
	 */
	private saveExecutionTimes(): Promise<void> {
		if (!this.context) {
			this.log("warn", "Cannot save execution times: context not set")
			return Promise.resolve()
		}

		try {
			const timesObject = Object.fromEntries(this.lastExecutionTimes.entries())
			// Convert Thenable to Promise and handle errors
			return Promise.resolve(this.context.globalState.update(this.STORAGE_KEY, timesObject))
				.then(() => {
					this.log("debug", `Saved ${this.lastExecutionTimes.size} rule execution times to storage`)
				})
				.catch((err: unknown) => {
					this.log(
						"error",
						`Failed to save execution times: ${err instanceof Error ? err.message : String(err)}`,
					)
				})
		} catch (err: unknown) {
			this.log("error", `Failed to save execution times: ${err instanceof Error ? err.message : String(err)}`)
			return Promise.resolve()
		}
	}

	/**
	 * Reset all rule execution times
	 */
	public resetAllRules(): Promise<void> {
		this.lastExecutionTimes.clear()
		this.log("debug", "All schedulable rules reset")
		return this.saveExecutionTimes()
	}

	/**
	 * Load all schedulable rules from a directory
	 * @param cwd - The current working directory
	 * @returns Promise resolving to an array of SchedulableRule objects
	 */
	public async loadSchedulableRules(cwd: string): Promise<SchedulableRule[]> {
		try {
			this.log("debug", `Loading schedulable rules from: ${cwd}`)
			const files = await fs.readdir(cwd)

			// Filter for files matching the pattern .clinerules-\d+[smhd]
			const ruleFiles = files.filter((file: string) => /^\.clinerules-\d+[smhd]$/.test(file))
			this.log("debug", `Found ${ruleFiles.length} schedulable rule files`)

			const rules: SchedulableRule[] = []

			for (const file of ruleFiles) {
				try {
					const filePath = path.join(cwd, file)
					const content = await fs.readFile(filePath, "utf-8")

					// Extract the time component (e.g., "5m" from ".clinerules-5m")
					const timeComponent = file.replace(/^\.clinerules-/, "")
					const { interval, unit, display } = parseTimeInterval(timeComponent)

					rules.push({
						filePath,
						fileName: file,
						interval,
						timeUnit: unit,
						displayInterval: display,
						content: content.trim(),
						lastExecuted: this.lastExecutionTimes.get(file) || 0,
					})

					this.log("debug", `Loaded rule file: ${file}, interval: ${display}`)
				} catch (err) {
					this.log(
						"error",
						`Failed to parse schedulable rule file ${file}: ${err instanceof Error ? err.message : String(err)}`,
					)
				}
			}

			return rules
		} catch (err) {
			this.log("error", `Failed to load schedulable rules: ${err instanceof Error ? err.message : String(err)}`)
			return []
		}
	}

	/**
	 * Check if a rule should be executed based on its interval
	 * @param rule - The rule to check
	 /**
	  * Check if a rule should be executed based on its interval
	  * @param rule - The rule to check
	  * @returns True if the rule should be executed, false otherwise
	  */
	public shouldExecuteRule(rule: SchedulableRule): boolean {
		const now = Date.now()
		const lastExecution = this.lastExecutionTimes.get(rule.fileName) || 0
		const timeElapsed = now - lastExecution
		const timeRemaining = Math.max(0, rule.interval - timeElapsed)
		const shouldExecute = timeElapsed >= rule.interval

		// Format time remaining in a human-readable format
		const formatTimeRemaining = (): string => {
			if (timeRemaining === 0) return "ready now"

			const seconds = Math.floor(timeRemaining / 1000) % 60
			const minutes = Math.floor(timeRemaining / (1000 * 60)) % 60
			const hours = Math.floor(timeRemaining / (1000 * 60 * 60))

			const parts = []
			if (hours > 0) parts.push(`${hours}h`)
			if (minutes > 0) parts.push(`${minutes}m`)
			if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

			return parts.join(" ")
		}

		// Always log at "info" level for better visibility in the output panel
		if (shouldExecute) {
			this.log(
				"info",
				`Rule ${rule.fileName} is ready to execute (last executed: ${lastExecution > 0 ? new Date(lastExecution).toISOString() : "never"})`,
			)
		} else {
			const nextRunTimeFormatted = new Date(lastExecution + rule.interval).toLocaleTimeString()
			this.log(
				"info", // Changed from debug to info for visibility
				`Rule ${rule.fileName} will execute in ${formatTimeRemaining()} at ${nextRunTimeFormatted} (last executed: ${new Date(lastExecution).toISOString()})`,
			)
		}

		return shouldExecute
	}
	/*
	 * Non-blocking method that saves the execution time to storage
	 * without requiring the caller to await
	 *
	 * @param rule - The rule to mark as executed
	 */
	public markRuleAsExecuted(rule: SchedulableRule): void {
		const now = Date.now()
		this.lastExecutionTimes.set(rule.fileName, now)
		this.log("info", `Rule ${rule.fileName} marked as executed at ${new Date(now).toISOString()}`)

		// Save to persistent storage without blocking
		// This ensures that even if the caller doesn't await the promise,
		// the execution times will still be saved to global state
		Promise.resolve(this.saveExecutionTimes()).catch((err: unknown) => {
			this.log(
				"error",
				`Failed to save execution times for ${rule.fileName}: ${err instanceof Error ? err.message : String(err)}`,
			)
		})
	}

	/**
	 * Get rules that should be executed
	 * @param cwd - The current working directory
	 * @returns Promise resolving to an array of rules that should be executed
	 */
	public async getExecutableRules(cwd: string): Promise<SchedulableRule[]> {
		const rules = await this.loadSchedulableRules(cwd)
		const executableRules = rules.filter((rule) => this.shouldExecuteRule(rule))
		this.log("debug", `Found ${executableRules.length} executable rules out of ${rules.length} total rules`)
		return executableRules
	}

	/**
	 * Get all rules with their status (for UI display)
	 * @param cwd - The current working directory
	 * @returns Promise resolving to an array of rules with next execution time
	 */
	public async getAllRules(
		cwd: string,
	): Promise<Array<SchedulableRule & { nextExecution: number; nextExecutionTimestamp: number }>> {
		const rules = await this.loadSchedulableRules(cwd)
		const now = Date.now()

		return rules.map((rule) => {
			const lastExecution = this.lastExecutionTimes.get(rule.fileName) || 0
			const nextExecutionTimestamp = lastExecution + rule.interval
			const timeRemaining = Math.max(0, nextExecutionTimestamp - now)

			// Format time remaining in a human-readable format
			const timeUntilNextRun = this.formatTimeRemaining(timeRemaining)

			// Format next run time as a nice clock time
			const nextRunTime = new Date(nextExecutionTimestamp).toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			})

			return {
				...rule,
				lastExecuted: lastExecution,
				nextExecution: timeRemaining,
				nextExecutionTimestamp: nextExecutionTimestamp, // Add absolute timestamp to enable UI countdown
				timeUntilNextRun: timeUntilNextRun, // Human-readable time remaining
				nextRunTime: nextRunTime, // Clock time of next execution
			}
		})
	}

	/**
	 * Format milliseconds into a human-readable time format
	 * @param milliseconds - Time in milliseconds
	 * @returns Human-readable time string
	 */
	private formatTimeRemaining(milliseconds: number): string {
		if (milliseconds === 0) return "ready now"

		const seconds = Math.floor(milliseconds / 1000) % 60
		const minutes = Math.floor(milliseconds / (1000 * 60)) % 60
		const hours = Math.floor(milliseconds / (1000 * 60 * 60))

		const parts = []
		if (hours > 0) parts.push(`${hours}h`)
		if (minutes > 0) parts.push(`${minutes}m`)
		if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

		return parts.join(" ")
	}
}
