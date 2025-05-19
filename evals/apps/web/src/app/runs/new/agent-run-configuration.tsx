"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { ChevronDown, ChevronUp } from "lucide-react"

import {
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	FormDescription,
	Input,
	Slider,
	Button,
	Textarea,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Switch,
} from "@/components/ui"

export function AgentRunConfiguration() {
	// Renamed function
	const [isOpen, setIsOpen] = useState(false)
	const { control, setValue, watch } = useFormContext()

	// Get current settings or initialize empty object
	const settings = watch("settings") || {}

	// Helper function to update settings
	const updateSetting = (key: string, value: any) => {
		setValue("settings", {
			...settings,
			[key]: value,
		})
	}

	return (
		<div className="mt-4 border rounded-md p-4">
			<Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
				<CollapsibleTrigger asChild>
					<Button variant="ghost" className="flex w-full justify-between p-2">
						<span className="font-medium">Agent & Run Configuration</span>
						{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent className="space-y-6 pt-4">
					{/* Model Parameters Section */}
					<div>
						<h3 className="text-lg font-medium mb-4">Model Parameters</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* Model Temperature */}
							<FormField
								control={control}
								name="settings.modelTemperature"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Model Temperature</FormLabel>
										<div className="flex items-center gap-2">
											<Slider
												defaultValue={[settings.modelTemperature ?? 0.7]}
												min={0}
												max={1}
												step={0.01}
												onValueChange={(value) => updateSetting("modelTemperature", value[0])}
											/>
											<span className="w-12 text-center">{settings.modelTemperature ?? 0.7}</span>
										</div>
										<FormDescription>
											Controls randomness: lower values are more deterministic
										</FormDescription>
									</FormItem>
								)}
							/>

							{/* Reasoning Effort */}
							<FormField
								control={control}
								name="settings.reasoningEffort"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Reasoning Effort</FormLabel>
										<FormControl>
											{/* TODO: Replace with Select/Radio Group if needed */}
											<Input
												placeholder="medium"
												value={settings.reasoningEffort ?? "medium"}
												onChange={(e) => updateSetting("reasoningEffort", e.target.value)}
											/>
										</FormControl>
										<FormDescription>Model's effort level (low, medium, high)</FormDescription>
									</FormItem>
								)}
							/>

							{/* Include Max Tokens */}
							<FormField
								control={control}
								name="settings.includeMaxTokens"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Include Max Tokens</FormLabel>
											<FormDescription>Send max_tokens parameter to API</FormDescription>
										</div>
										<FormControl>
											<Switch
												checked={settings.includeMaxTokens ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("includeMaxTokens", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>

					{/* Terminal Configuration Section (Placeholder) */}
					<div className="border-t pt-6">
						<h3 className="text-lg font-medium mb-4">Terminal Configuration</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* Terminal Output Line Limit */}
							<FormField
								control={control}
								name="settings.terminalOutputLineLimit"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Terminal Output Line Limit</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												value={settings.terminalOutputLineLimit ?? 500}
												onChange={(e) =>
													updateSetting("terminalOutputLineLimit", Number(e.target.value))
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{/* Terminal Shell Integration Timeout */}
							<FormField
								control={control}
								name="settings.terminalShellIntegrationTimeout"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Terminal Shell Integration Timeout</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												value={settings.terminalShellIntegrationTimeout ?? 10000}
												onChange={(e) =>
													updateSetting(
														"terminalShellIntegrationTimeout",
														Number(e.target.value),
													)
												}
											/>
										</FormControl>
										<FormDescription>Timeout in milliseconds</FormDescription>
									</FormItem>
								)}
							/>

							{/* Terminal Command Delay */}
							<FormField
								control={control}
								name="settings.terminalCommandDelay"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Terminal Command Delay</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												value={settings.terminalCommandDelay ?? 1000}
												onChange={(e) =>
													updateSetting("terminalCommandDelay", Number(e.target.value))
												}
											/>
										</FormControl>
										<FormDescription>Delay in milliseconds</FormDescription>
									</FormItem>
								)}
							/>
							{/* Terminal PowerShell Counter */}
							<FormField
								control={control}
								name="settings.terminalPowershellCounter"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Terminal PowerShell Counter</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.terminalPowershellCounter ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("terminalPowershellCounter", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{/* Terminal Zsh Clear EOL Mark */}
							<FormField
								control={control}
								name="settings.terminalZshClearEolMark"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Terminal Zsh Clear EOL Mark</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.terminalZshClearEolMark ?? true}
												onCheckedChange={(value: boolean) =>
													updateSetting("terminalZshClearEolMark", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{/* Terminal Zsh Oh My */}
							<FormField
								control={control}
								name="settings.terminalZshOhMy"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Terminal Zsh Oh My</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.terminalZshOhMy ?? true}
												onCheckedChange={(value: boolean) =>
													updateSetting("terminalZshOhMy", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{/* Terminal Zsh P10k */}
							<FormField
								control={control}
								name="settings.terminalZshP10k"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Terminal Zsh P10k</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.terminalZshP10k ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("terminalZshP10k", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{/* Terminal Zdotdir */}
							<FormField
								control={control}
								name="settings.terminalZdotdir"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Terminal Zdotdir</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.terminalZdotdir ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("terminalZdotdir", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Terminal Shell Integration Disabled */}
							<FormField
								control={control}
								name="settings.terminalShellIntegrationDisabled"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Disable Terminal Shell Integration</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.terminalShellIntegrationDisabled ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("terminalShellIntegrationDisabled", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Terminal Compress Progress Bar */}
							<FormField
								control={control}
								name="settings.terminalCompressProgressBar"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Compress Terminal Progress Bar</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.terminalCompressProgressBar ?? true}
												onCheckedChange={(value: boolean) =>
													updateSetting("terminalCompressProgressBar", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
						{/* Allowed Commands */}
						<FormField
							control={control}
							name="settings.allowedCommands"
							render={({ field }) => (
								<FormItem className="col-span-full mt-4">
									{" "}
									{/* Added mt-4 */}
									<FormLabel>Allowed Terminal Commands</FormLabel>
									<FormControl>
										<Textarea
											placeholder="npm test, git diff, *"
											value={(settings.allowedCommands || []).join(", ")}
											onChange={(e) => {
												const commands = e.target.value
													.split(",")
													.map((cmd) => cmd.trim())
													.filter(Boolean)
												updateSetting("allowedCommands", commands)
											}}
										/>
									</FormControl>
									<FormDescription>
										Comma-separated list of commands the agent is allowed to execute (use * for
										all).
									</FormDescription>
								</FormItem>
							)}
						/>
					</div>

					{/* File & Context Limits Section */}
					<div className="border-t pt-6">
						<h3 className="text-lg font-medium mb-4">File & Context Limits</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* Max Read File Line */}
							<FormField
								control={control}
								name="settings.maxReadFileLine"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Max Read File Line</FormLabel>
										<FormControl>
											<Input
												type="number"
												value={settings.maxReadFileLine ?? -1}
												onChange={(e) =>
													updateSetting("maxReadFileLine", Number(e.target.value))
												}
											/>
										</FormControl>
										<FormDescription>Maximum lines to read (-1 for unlimited)</FormDescription>
									</FormItem>
								)}
							/>
							{/* Max Open Tabs Context */}
							<FormField
								control={control}
								name="settings.maxOpenTabsContext"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Max Open Tabs Context</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												value={settings.maxOpenTabsContext ?? 10}
												onChange={(e) =>
													updateSetting("maxOpenTabsContext", Number(e.target.value))
												}
											/>
										</FormControl>
										<FormDescription>
											Max number of open editor tabs to include as context
										</FormDescription>
									</FormItem>
								)}
							/>
							{/* Max Workspace Files */}
							<FormField
								control={control}
								name="settings.maxWorkspaceFiles"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Max Workspace Files</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												value={settings.maxWorkspaceFiles ?? 1000}
												onChange={(e) =>
													updateSetting("maxWorkspaceFiles", Number(e.target.value))
												}
											/>
										</FormControl>
										<FormDescription>Max number of workspace files to list</FormDescription>
									</FormItem>
								)}
							/>
						</div>
					</div>

					{/* Tool Behavior & Security Section */}
					<div className="border-t pt-6">
						<h3 className="text-lg font-medium mb-4">Tool Behavior & Security</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* Rate Limit Seconds */}
							<FormField
								control={control}
								name="settings.rateLimitSeconds"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Rate Limit (seconds)</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												value={settings.rateLimitSeconds ?? 0}
												onChange={(e) =>
													updateSetting("rateLimitSeconds", Number(e.target.value))
												}
											/>
										</FormControl>
										<FormDescription>Delay between API requests (0 for no limit)</FormDescription>
									</FormItem>
								)}
							/>
							{/* Request Delay Seconds */}
							<FormField
								control={control}
								name="settings.requestDelaySeconds"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Request Delay (seconds)</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												value={settings.requestDelaySeconds ?? 0}
												onChange={(e) =>
													updateSetting("requestDelaySeconds", Number(e.target.value))
												}
											/>
										</FormControl>
										<FormDescription>Delay before sending API request</FormDescription>
									</FormItem>
								)}
							/>
							{/* Write Delay Ms */}
							<FormField
								control={control}
								name="settings.writeDelayMs"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Write Delay (ms)</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												value={settings.writeDelayMs ?? 0}
												onChange={(e) => updateSetting("writeDelayMs", Number(e.target.value))}
											/>
										</FormControl>
										<FormDescription>Delay before applying file writes</FormDescription>
									</FormItem>
								)}
							/>
							{/* Fuzzy Match Threshold */}
							<FormField
								control={control}
								name="settings.fuzzyMatchThreshold"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Fuzzy Match Threshold</FormLabel>
										<div className="flex items-center gap-2">
											<Slider
												defaultValue={[settings.fuzzyMatchThreshold ?? 0.8]}
												min={0}
												max={1}
												step={0.01}
												onValueChange={(value) =>
													updateSetting("fuzzyMatchThreshold", value[0])
												}
											/>
											<span className="w-12 text-center">
												{settings.fuzzyMatchThreshold ?? 0.8}
											</span>
										</div>
										<FormDescription>Threshold for apply_diff fuzzy matching</FormDescription>
									</FormItem>
								)}
							/>
							{/* Auto Approval Enabled */}
							<FormField
								control={control}
								name="settings.autoApprovalEnabled"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Auto-Approval</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.autoApprovalEnabled ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("autoApprovalEnabled", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Allow ReadOnly */}
							<FormField
								control={control}
								name="settings.alwaysAllowReadOnly"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Allow ReadOnly (Workspace)</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysAllowReadOnly ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysAllowReadOnly", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Allow ReadOnly Outside Workspace */}
							<FormField
								control={control}
								name="settings.alwaysAllowReadOnlyOutsideWorkspace"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Allow ReadOnly (Outside)</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysAllowReadOnlyOutsideWorkspace ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysAllowReadOnlyOutsideWorkspace", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Allow Write */}
							<FormField
								control={control}
								name="settings.alwaysAllowWrite"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Allow Write (Workspace)</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysAllowWrite ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysAllowWrite", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Allow Write Outside Workspace */}
							<FormField
								control={control}
								name="settings.alwaysAllowWriteOutsideWorkspace"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Allow Write (Outside)</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysAllowWriteOutsideWorkspace ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysAllowWriteOutsideWorkspace", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Allow Browser */}
							<FormField
								control={control}
								name="settings.alwaysAllowBrowser"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Allow Browser</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysAllowBrowser ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysAllowBrowser", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Approve Resubmit */}
							<FormField
								control={control}
								name="settings.alwaysApproveResubmit"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Approve Resubmit</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysApproveResubmit ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysApproveResubmit", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Allow MCP */}
							<FormField
								control={control}
								name="settings.alwaysAllowMcp"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Allow MCP</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysAllowMcp ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysAllowMcp", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Allow Mode Switch */}
							<FormField
								control={control}
								name="settings.alwaysAllowModeSwitch"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Allow Mode Switch</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysAllowModeSwitch ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysAllowModeSwitch", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Allow Subtasks */}
							<FormField
								control={control}
								name="settings.alwaysAllowSubtasks"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Allow Subtasks</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysAllowSubtasks ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysAllowSubtasks", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Always Allow Execute */}
							<FormField
								control={control}
								name="settings.alwaysAllowExecute"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Always Allow Execute</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.alwaysAllowExecute ?? false}
												onCheckedChange={(value: boolean) =>
													updateSetting("alwaysAllowExecute", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{/* Diff Enabled */}
							<FormField
								control={control}
								name="settings.diffEnabled"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Diff View Enabled</FormLabel>
										</div>
										<FormControl>
											<Switch
												checked={settings.diffEnabled ?? true}
												onCheckedChange={(value: boolean) =>
													updateSetting("diffEnabled", value)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>

					{/* Custom Prompts Section */}
					<div className="border-t pt-6">
						<h3 className="text-lg font-medium mb-4">Custom Prompts</h3>
						{/* Role Definition */}
						<FormField
							control={control}
							name="settings.customModePrompts.code.roleDefinition"
							render={({ field }) => (
								<FormItem className="mb-4">
									<FormLabel>Role Definition</FormLabel>
									<FormControl>
										<Textarea
											placeholder="You are Roo, an advanced AI software engineering assistant with deep expertise across programming languages, frameworks, and best practices."
											className="min-h-[100px]"
											value={settings.customModePrompts?.code?.roleDefinition || ""}
											onChange={(e) => {
												const customModePrompts = settings.customModePrompts || {}
												const codePrompt = customModePrompts.code || {}
												updateSetting("customModePrompts", {
													...customModePrompts,
													code: {
														...codePrompt,
														roleDefinition: e.target.value,
													},
												})
											}}
										/>
									</FormControl>
									<FormDescription>
										Define the role for the AI assistant (leave empty to use default)
									</FormDescription>
								</FormItem>
							)}
						/>

						{/* Custom Instructions */}
						<FormField
							control={control}
							name="settings.customModePrompts.code.customInstructions"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Custom Instructions</FormLabel>
									<FormControl>
										<Textarea
											placeholder="When programming, prioritize the following: First understand the requirements fully, consider architecture and design before implementation..."
											className="min-h-[200px]"
											value={settings.customModePrompts?.code?.customInstructions || ""}
											onChange={(e) => {
												const customModePrompts = settings.customModePrompts || {}
												const codePrompt = customModePrompts.code || {}
												updateSetting("customModePrompts", {
													...customModePrompts,
													code: {
														...codePrompt,
														customInstructions: e.target.value,
													},
												})
											}}
										/>
									</FormControl>
									<FormDescription>
										Custom instructions for the AI assistant (leave empty to use default)
									</FormDescription>
								</FormItem>
							)}
						/>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	)
}
