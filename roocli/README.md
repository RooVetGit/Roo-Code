# RooCLI

A command line interface for RooCode that communicates with the RooCode extension via WebSocket.

## Prerequisites

Before using the CLI, you need to enable the WebSocket server in the RooCode extension settings:

1. Open VS Code settings (File > Preferences > Settings or Ctrl+,)
2. Search for "roo-cline.websocket.enabled"
3. Ensure this setting is checked/enabled (it should be enabled by default)

Alternatively, you can add this to your settings.json file:

```json
"roo-cline.websocket.enabled": true
```

## Installation

### From the Monorepo

```bash
# Install dependencies (from the root of the monorepo)
pnpm install

# Build the CLI and its dependencies
pnpm build:cli-deps

# Install the CLI globally from the local package
pnpm --global install ./roocli
```

### Standalone Installation

If you've downloaded just the CLI package:

```bash
# Install dependencies
pnpm install

# Build the CLI
pnpm build

# Install globally
pnpm --global install .
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

### In the Monorepo

```bash
# Run in development mode (from the root of the monorepo)
pnpm --filter @roo-code/cli dev

# Run a specific command in development mode
cd roocli && npx ts-node src/index.ts create task --mode ask --message "Your message"

# Build the comms-clients package (dependency)
pnpm build:comms

# Build the CLI
pnpm build:cli

# Build both in the correct order
pnpm build:cli-deps
```

### Standalone Development

```bash
# Run in development mode
pnpm dev

# Build the CLI
pnpm build
```

## Requirements

- Node.js 20.16.0 or higher (20.18.1 recommended)
- pnpm 10.8.1 or higher (when using the monorepo)
- RooCode extension must be running with the WebSocket server enabled (see Prerequisites section)

## Monorepo Structure

This CLI is part of the RooCode monorepo and depends on the following packages:

- `@roo-code/comms-clients`: Communication clients for WebSocket connectivity

When working in the monorepo, make sure to build dependencies in the correct order using the provided scripts.

For more detailed usage instructions, see [USAGE.md](./USAGE.md).
