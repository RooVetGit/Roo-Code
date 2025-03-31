export function getSwitchModeDescription(): string {
	return `## switch_mode
Request to switch modes (requires user approval).

Parameters:
- mode_slug: Mode to switch to (required, e.g. "code")
- reason: Optional reason for switch

Usage:
<switch_mode>
<mode_slug>target_mode</mode_slug>
<reason>switch_reason</reason>  <!-- optional -->
</switch_mode>

Example:
<switch_mode>
<mode_slug>code</mode_slug>
<reason>Make code changes</reason>
</switch_mode>`
}
