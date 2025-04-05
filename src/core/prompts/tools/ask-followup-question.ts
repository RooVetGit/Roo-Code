export function getAskFollowupQuestionDescription(): string {
	return `## ask_followup_question
Ask user for needed information with suggested answers.

Parameters:
- question: Clear, specific question (required)
- follow_up: 2-4 suggestions (required) in <suggest> tags:
	 - Must be complete, actionable answers
	 - No placeholders or incomplete info
	 - Ordered by priority

Usage:
<ask_followup_question>
<question>your_question</question>
<follow_up>
<suggest>option1</suggest>
<suggest>option2</suggest>
</follow_up>
</ask_followup_question>

Example: Path question
<ask_followup_question>
<question>Path to config file?</question>
<follow_up>
<suggest>./src/config.json</suggest>
<suggest>./config.json</suggest>
</follow_up>
</ask_followup_question>`
}
