export function getSwitchModeDescription(): string {
	return `{switch-mode.ts}`
	return `## switch_mode
Description: Request to switch to a different mode. This tool allows modes to request switching to another mode when needed, such as switching to 'editer' mode to make code changes. The user must approve the mode switch.
Parameters:
- mode_slug: (required) The slug of the mode to switch to (e.g., "editor", "asker", "operator", "reader")
- reason: (optional) The reason for switching modes
Usage:
<switch_mode>
<mode_slug>Mode slug here</mode_slug>
<reason>Reason for switching here</reason>
</switch_mode>

Example: Requesting to switch to 'editor' mode
<switch_mode>
<mode_slug>editor</mode_slug>
<reason>Need to make code changes</reason>
</switch_mode>`
}
