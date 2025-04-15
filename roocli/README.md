# RooCLI

A command line interface for RooCode that communicates with the RooCode extension via WebSocket.

## Installation

```bash
# Install dependencies
npm install

# Build the CLI
npm run build

# Install globally
npm install -g .
```

## Usage

```bash
# Get help
roo --help

# Get command-specific help
roo <command> --help
```

## Commands

The RooCode CLI uses a consistent command structure with the following main commands:

- `list`: Display information about configurations, profiles, and tasks
- `create`: Create new configurations, profiles, and tasks
- `update`: Update existing configurations, profiles, and tasks
- `delete`: Delete configurations, profiles, and tasks
- `set`: Set new configurations
- `profile`: Manage profiles directly

Each command applies to three object types: configs, profiles, and tasks.

### List Command

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

### Create Command

```bash
# Create a new configuration from JSON
roo create config --json '{"apiProvider": "openai", "openAiModelId": "gpt-4", "openAiApiKey": "sk-your-key"}'

# Create a new profile
roo create profile --name "GPT-4" --config "default"

# Create a new task
roo create task --mode "code" --message "Create a React component"
```

### Set Command

```bash
# Set a new configuration from JSON
roo set config --json '{"apiProvider": "openai", "openAiModelId": "gpt-4", "openAiApiKey": "sk-your-key"}'

# Set a new configuration from a file
roo set config --file path/to/config.json
```

### Update Command

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

```bash
# Create a new profile
roo profile create --name "GPT-4" --config "default"

# Set a profile as active
roo profile --name "GPT-4" --active

# Delete a profile
roo profile delete --name "GPT-4"
```

### Delete Command

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
roo set config --json '{"apiProvider": "openai", "openAiModelId": "gpt-4"}'

# Create a new profile with this configuration
roo profile create --name "My Project" --config "default"

# Set it as active
roo profile --name "My Project" --active

# Start a new task
roo create task --mode "code" --message "Create a React component that fetches data from an API"
```

## Development

```bash
# Run in development mode
npm run dev

# Build the CLI
npm run build
```

## Requirements

- Node.js 14 or higher
- RooCode extension must be running with the WebSocket server enabled

For more detailed usage instructions, see [USAGE.md](./USAGE.md).
