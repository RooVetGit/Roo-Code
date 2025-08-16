export function getAskFollowupQuestionDescription(): string {
	return `## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively.

Parameters:
- question: (required) A clear, specific question addressing the information needed
- follow_up: (required) A list of 2-4 suggested answers, each in its own <suggest> tag. Suggestions must be complete, actionable answers without placeholders. Optionally include <mode> to switch modes (code/architect/etc.)

Usage:
<ask_followup_question>
<question>Your question here</question>
<follow_up>
<suggest><content>First suggestion</content></suggest>
<suggest><mode>code</mode><content>Action with mode switch</content></suggest>
</follow_up>
</ask_followup_question>

Example:
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
<follow_up>
<suggest><content>./src/frontend-config.json</content></suggest>
<suggest><content>./config/frontend-config.json</content></suggest>
<suggest><content>./frontend-config.json</content></suggest>
</follow_up>
</ask_followup_question>`
}
