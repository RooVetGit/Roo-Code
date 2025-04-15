# RooCode CLI Usage Guide

## Overview

The RooCode CLI is a command-line interface for interacting with the RooCode VS Code extension. It allows you to manage profiles, start tasks, and interact with RooCode directly from your terminal.

## Installation

### Prerequisites

- Node.js 14 or higher
- npm
- VS Code with RooCode extension installed
- WebSocket server enabled in RooCode extension settings

### Installing the CLI

```bash
# Install from npm
npm install -g roocli

# Or install from source
git clone https://github.com/RooVetGit/Roo-Code.git
cd Roo-Code/roocli
npm install
npm run build
npm install -g .
```

## Configuration

Before using the CLI, you need to enable the WebSocket server in the RooCode extension:

1. Open VS Code settings (File > Preferences > Settings or Ctrl+,)
2. Search for "roo-cline.websocket.enabled"
3. Set it to `true`
4. Optionally, configure the port with "roo-cline.websocket.port" (default: 8765)
5. Restart VS Code to apply the changes

## Basic Usage

```bash
# Get help
roo --help

# Get command-specific help
roo <command> --help

# Check if RooCode is ready
roo list configs
```

## Command Reference

The RooCode CLI uses a consistent command structure with four main commands:

- `list`: Display information about configurations, profiles, and tasks
- `create`: Create new configurations, profiles, and tasks
- `update`: Update existing configurations, profiles, and tasks
- `delete`: Delete configurations, profiles, and tasks

Each command applies to three object types: configs, profiles, and tasks.

### List Command

The `list` command retrieves information from RooCode:

```bash
# List all configurations (concise view)
roo list configs

# List all configurations (detailed view)
roo list configs --verbose

# List all configurations (concise view with ability to expand individual configurations)
roo list configs --expandable

# List all profiles
roo list profiles

# List only the active profile
roo list profiles --active

# List all tasks
roo list tasks
```

#### Example Output

```
┌─────────────────────────────────────────────────────────────────┐
│                         Configurations                          │
├─────────────────────────────────────────────────────────────────┤
│ default: openai                                                 │
│ gpt4: openai                                                    │
│ claude: anthropic                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Create Command

The `create` command creates new objects:

```bash
# Create a new configuration from JSON
roo create config --json '{"apiProvider": "openai", "openAiModelId": "gpt-4", "openAiApiKey": "sk-your-key"}'

# Create a new profile
roo create profile --name "GPT-4" --config "default"

# Create a new task
roo create task --mode "code" --message "Create a React component"
```

### Set Command

The `set` command adds new configurations:

```bash
# Set a new configuration from JSON
roo set config --json '{"apiProvider": "openai", "openAiModelId": "gpt-4", "openAiApiKey": "sk-your-key"}'

# Set a new configuration from a file
roo set config --file path/to/config.json
```

### Update Command

The `update` command updates existing objects:

```bash
# Update a configuration
roo update config --name "default" --json '{"apiProvider": "openai", "openAiModelId": "gpt-4-turbo"}'

# Send a message to the current task
roo update task --message "Add a button to the component"

# Change the mode of the current task
roo update task --mode "debug"

# Interact with the current task
roo update task --interact primary
```

### Profile Command

The `profile` command manages profiles:

```bash
# Create a new profile
roo profile create --name "GPT-4" --config "default"

# Set a profile as active
roo profile --name "GPT-4" --active

# Delete a profile
roo profile delete --name "GPT-4"
```

### Delete Command

The `delete` command removes objects:

```bash
# Delete a configuration
roo delete config --name "old-config"

# Delete a configuration without confirmation
roo delete config --name "old-config" --force

# Delete a profile
roo delete profile --name "GPT-4"

# Delete a task
roo delete task --id "task-123"
```

## Common Workflows

### Setting Up a New Profile and Starting a Task

```bash
# Create a new configuration
roo create config --json '{"apiProvider": "openai", "openAiModelId": "gpt-4"}'

# Create a new profile with this configuration
roo create profile --name "My Project" --config "default"

# Set it as active
roo update profile --name "My Project" --active

# Start a new task
roo create task --mode "code" --message "Create a React component that fetches data from an API"
```

### Continuing Work on an Existing Task

```bash
# List the current tasks
roo list tasks

# Send additional instructions to the current task
roo update task --message "Now add error handling to the API request"

# Interact with the task
roo update task --interact primary
```

### Switching Between Different Projects

```bash
# List all profiles
roo list profiles

# Switch to a different profile
roo update profile --name "Project B" --active

# Start a new task for this project
roo create task --mode "code" --message "Update the database schema"
```

## Tips and Best Practices

### Effective Task Descriptions

- Be specific and clear in your task descriptions
- Include relevant context and requirements
- Break complex tasks into smaller, manageable pieces

Example:

```bash
# Too vague
roo create task --mode "code" --message "Create a component"

# Better
roo create task --mode "code" --message "Create a React form component with email and password fields, validation, and a submit button that calls the login API"
```

### Managing Multiple Tasks

- Use `roo list tasks` to see all active tasks
- Clear completed tasks to keep your workspace organized

### Troubleshooting

If you encounter issues:

1. Check if the WebSocket server is enabled in VS Code settings
2. Verify VS Code is running with the RooCode extension active
3. Check the connection with `roo list configs`
4. Look for error messages in the terminal output
5. Restart VS Code and try again

## Advanced Usage

### Scripting with the CLI

You can use the RooCode CLI in scripts to automate workflows:

```bash
#!/bin/bash
# Example script to start a task and wait for completion

# Start a new task
TASK_ID=$(roo create task --mode "code" --message "Generate unit tests for the user service" | grep -oP 'ID: \K[^"]+')

# Wait for the task to complete (in a real script, you would implement a proper waiting mechanism)
echo "Task started with ID: $TASK_ID. Waiting for completion..."

# When done, send a final message
roo update task --message "Tests generated successfully"
```

### Using the CLI Programmatically

You can also use the CLI programmatically in Node.js applications:

```javascript
const { exec } = require("child_process")

function startRooTask(taskDescription) {
	return new Promise((resolve, reject) => {
		exec(`roo create task --mode "code" --message "${taskDescription}"`, (error, stdout, stderr) => {
			if (error) {
				reject(error)
				return
			}

			// Extract task ID from output
			const match = stdout.match(/ID: ([a-zA-Z0-9-]+)/)
			if (match && match[1]) {
				resolve(match[1])
			} else {
				reject(new Error("Could not extract task ID"))
			}
		})
	})
}

// Usage
startRooTask("Create a React component")
	.then((taskId) => {
		console.log(`Task started with ID: ${taskId}`)
	})
	.catch((error) => {
		console.error("Error starting task:", error)
	})
```

## Conclusion

The RooCode CLI provides a powerful way to interact with RooCode from the command line. By mastering these commands and workflows, you can integrate RooCode into your development process more efficiently.

For more information, visit the [RooCode documentation](https://docs.roocode.com) or join the [RooCode Discord community](https://discord.gg/roocode).
