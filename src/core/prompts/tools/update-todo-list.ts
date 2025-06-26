import { ToolArgs } from "./types"

/**
 * Get the description for the update_todo_list tool.
 */
export function getUpdateTodoListDescription(args?: ToolArgs): string {
	return `## update_todo_list
Description: Used to fully update (replace) the entire TODO list. Each time you call this tool, you must provide the complete checklist. The system will overwrite the existing todo list with the provided checklist. This is useful for task tracking, workflow management, and progress monitoring.

**The list should be generated in execution order.**

**Important:** Unless the user explicitly requests deletion, do NOT remove any existing unfinished todo items. Only update their status (for example, change [ ] to [x] or [-]) as progress is made. Always keep all previous unfinished tasks in the list, updating their status as needed. Do not delete any unfinished tasks just because their status has changed.

Parameter format (markdown checklist):
- todos: (required) markdown checklist, one todo per line, using the following format:
	 - [ ] Task content (pending)
	 - [x] Task content (completed)
	 - [-] Task content (in progress)
	 - [~] Task content (in progress, equivalent to [-])

Status mapping:
- [ ] means "pending"
- [x] means "completed"
- [-] or [~] means "in_progress"

**Usage Example (only update status, do not delete items):**
<update_todo_list>
<todos>
[x] Write project documentation
[-] Code review
[ ] Unit testing
[ ] Deploy to production
</todos>
</update_todo_list>

### When to Use This Tool

Use this tool in the following situations:
1. The task involves three or more distinct steps.
2. The task is complex and requires careful planning or multiple operations.
3. The user specifically asks for a todo list.
4. The user provides multiple tasks at once (e.g., a numbered or comma-separated list).
5. New instructions are received—immediately capture them as todos.
6. Before starting any task, mark it as in_progress (ideally, only one task should be in progress at a time).
7. After completing a task, mark it as completed and add any new follow-up tasks discovered during the process.

### When NOT to Use This Tool

Do not use this tool if:
1. There is only a single, straightforward task.
2. The task is trivial and tracking it offers no organizational benefit.
3. The task can be completed in fewer than three simple steps.
4. The request is purely conversational or informational.


### Task States and Management

- **Task States:**
  - pending: Not started
  - in_progress: Currently being worked on (only one at a time)
  - completed: Finished successfully

- **Task Management:**
  - Update task status in real time as you work.
  - Mark tasks as completed immediately after finishing (do not batch completions).
  - Only one task should be in progress at any time.
  - Finish current tasks before starting new ones.
  - Remove tasks from the list if they are no longer relevant.

- **Task Completion Requirements:**
  - Mark a task as completed only when it is fully accomplished.
  - If blocked or unable to finish, keep the task as in_progress and create a new task describing what needs to be resolved.
  - Never mark a task as completed if:
    - Tests are failing
    - The implementation is partial
    - There are unresolved errors
    - Required files or dependencies are missing

- **Task Breakdown:**
  - Create specific, actionable items.
  - Break complex tasks into smaller, manageable steps.
  - Use clear and descriptive task names.
`
}
