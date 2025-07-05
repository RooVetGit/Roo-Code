export function getManageTodoListDescription(): string {
	return `## manage_todo_list
Description: Manage a todo list to track progress during complex task execution. This tool helps ensure no steps are missed by maintaining a persistent list of tasks and their completion status. Use this tool to add items, mark them as complete, view the current list, or clear completed items.
Parameters:
- todo_action: (required) The action to perform. Valid values are:
  - "add": Add a new item to the todo list
  - "complete": Mark an item as completed
  - "list": Display the current todo list with completion status
  - "clear_completed": Remove all completed items from the list
  - "clear_all": Clear the entire todo list
- todo_item: (required for "add" action) The description of the todo item to add
- item_id: (required for "complete" action) The ID of the item to mark as completed

Usage:
<manage_todo_list>
<todo_action>action_name</todo_action>
<todo_item>item description (for add action)</todo_item>
<item_id>item_id (for complete action)</item_id>
</manage_todo_list>

Examples:

1. Add a new todo item:
<manage_todo_list>
<todo_action>add</todo_action>
<todo_item>Create user authentication system</todo_item>
</manage_todo_list>

2. Mark an item as completed:
<manage_todo_list>
<todo_action>complete</todo_action>
<item_id>1</item_id>
</manage_todo_list>

3. View the current todo list:
<manage_todo_list>
<todo_action>list</todo_action>
</manage_todo_list>

4. Clear completed items:
<manage_todo_list>
<todo_action>clear_completed</todo_action>
</manage_todo_list>

5. Clear all items:
<manage_todo_list>
<todo_action>clear_all</todo_action>
</manage_todo_list>`
}
