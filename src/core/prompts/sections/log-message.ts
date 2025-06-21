export function getLogMessageSection(): string {
	return `====

LOG MESSAGES

You can use log messages to output debugging information to the VSCode output channel. Unlike tools, log messages don't require approval and don't count toward the one-tool-per-message limit.

# Purpose and Context

The VSCode OutputChannel is a dedicated console-like interface within VSCode where extensions can write diagnostic information, separate from the user's workspace files.

Unlike other tools that create or modify files in the workspace, log messages are purely for diagnostic purposes within the extension's runtime environment.

# Log Message Formatting

Log messages are formatted using XML-style tags. Here's the structure:

<log_message>
<message>Your log message here</message>
<level>info</level>
</log_message>

The level parameter is optional and defaults to "info". Valid levels are: "debug", "info", "warn", and "error".

For example:

<log_message>
<message>Starting task execution</message>
<level>info</level>
</log_message>

<log_message>
<message>Failed to parse input: invalid JSON</message>
<level>error</level>
</log_message>

You can use log messages multiple times in a single message, and they will be processed immediately without requiring user approval.
`
}
