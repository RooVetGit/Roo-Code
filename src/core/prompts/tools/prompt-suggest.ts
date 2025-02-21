import { ToolArgs } from "./types"

export function getPromptSuggestDescription(args: ToolArgs): string {
	return `## prompt_suggest
Description: Provide a list of suggested next prompts or tasks to the user based on the current context. This tool helps Roo guide users by offering relevant next steps or suggesting task splits (using the new_task tool) when the context becomes too large.
Parameters:
- values: (required) A list of suggested prompt/task/question for user as XML elements. The order of suggestion is important, the order of suggestion is the same with the order that show to user.. Each suggested can have these elements:
	* suggest (required): A suggestion to display to the user. Each suggestion must be provided in its own <suggest> tag. Each suggestion can be multiple line.

Usage:
<prompt_suggest>
<values>
<suggest>
- Suggested prompt or task 1
</suggest>
<suggest>
- Suggested prompt or task 2
</suggest>
</values>
</prompt_suggest>

Example: After completing a feature implementation (Code mode)
<prompt_suggest>
<values>
<suggest>
- Add unit tests for the new feature
</suggest>
<suggest>
- Update documentation with usage examples
</suggest>
<suggest>
- Create integration tests to verify feature behavior
</suggest>
<suggest>
- Review code for potential optimizations
</suggest>
</values>
</prompt_suggest>

Example: When debugging an issue (Code mode)
<prompt_suggest>
<values>
<suggest>
- Check logs for error messages
</suggest>
<suggest>
- Run tests to reproduce the issue
</suggest>
<suggest>
- Review recent code changes
</suggest>
<suggest>
- Profile the application for performance bottlenecks
</suggest>
</values>
</prompt_suggest>

Example: System architecture planning (Architect mode)
<prompt_suggest>
<values>
<suggest>
- Document system dependencies and interactions
</suggest>
<suggest>
- Review scalability considerations
</suggest>
<suggest>
- Analyze potential security implications
</suggest>
<suggest>
- Create technical specification for new features
</suggest>
<suggest>
- Document design decisions and tradeoffs
</suggest>
</values>
</prompt_suggest>

Example: Documentation planning (Architect mode)
<prompt_suggest>
<values>
<suggest>
- Create API documentation structure
</suggest>
<suggest>
- Document deployment procedures
</suggest>
<suggest>
- Write system architecture overview
</suggest>
<suggest>
- Split into new task using new_task: Create user guide
</suggest>
<suggest>
- Split into new task using new_task: Write developer onboarding guide
</suggest>
</values>
</prompt_suggest>

Example: Technical questions (Ask mode)
<prompt_suggest>
<values>
<suggest>
- What are the performance implications of this approach?
</suggest>
<suggest>
- How does this compare to alternative solutions?
</suggest>
<suggest>
- What are the best practices for this use case?
</suggest>
<suggest>
- Can you explain the security considerations?
</suggest>
</values>
</prompt_suggest>

Example: Documentation questions (Ask mode)
<prompt_suggest>
<values>
<suggest>
- What are the key components that need documentation?
</suggest>
<suggest>
- How should we structure the API documentation?
</suggest>
<suggest>
- What examples would be most helpful for users?
</suggest>
<suggest>
- What edge cases should be documented?
</suggest>
</values>
</prompt_suggest>

Example: When context window is large (>70%)
<prompt_suggest>
<values>
<suggest>
- Split into new task using new_task: Write end-to-end tests for user authentication
</suggest>
<suggest>
- Split into new task using new_task: Add input validation to all forms
</suggest>
<suggest>
- Continue current task: Complete the login flow implementation
</suggest>
</values>
</prompt_suggest>`
}
