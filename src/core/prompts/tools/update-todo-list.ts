import { ToolArgs } from "./types"

/**
 * Get the description for the update_todo_list tool.
 */
export function getUpdateTodoListDescription(args?: ToolArgs): string {
	return `## update_todo_list

**Description:**
Maintain a single authoritative, ordered checklist for the task. Always send the full list (the system replaces it entirely). Default to using this tool for any task with more than one step. Update it after each meaningful change: completing an item, starting the next, discovering a new item, or becoming blocked.

**Checklist Format:**
- Use a single-level markdown checklist (no nesting).
- List todos in execution order.
- Status options:
  - [ ] Task description (pending)
  - [x] Task description (completed)
  - [-] Task description (in progress)

**Status Rules:**
- [ ] = pending
- [x] = completed (fully finished, no unresolved issues)
- [-] = in_progress (currently being worked on or temporarily blocked)

**Core Principles:**
- Keep all unfinished items; do not drop them.
- You may update multiple statuses at once.
- If blocked, keep [-] and add a todo describing the blocker.
- Remove items only if no longer relevant or explicitly requested.

**Usage Example:**
<update_todo_list>
<todos>
[x] Analyze requirements
[x] Design architecture
[-] Implement core logic
[ ] Write tests
[ ] Update documentation
</todos>
</update_todo_list>

*After completing "Implement core logic" and starting "Write tests":*
<update_todo_list>
<todos>
[x] Analyze requirements
[x] Design architecture
[x] Implement core logic
[-] Write tests
[ ] Update documentation
[ ] Add performance benchmarks
</todos>
</update_todo_list>

**When to Use:**
- Multi-step or evolving tasks
- Tracking progress across messages
- When a TODO list is requested

**When NOT to Use:**
- Truly single-step, trivial actions only.

**Task Management Guidelines:**
- Mark a task completed as soon as it is fully done.
- Start the next task by marking it [-].
- Add new todos as soon as they are identified.
- Use clear, descriptive task names.
`
}
