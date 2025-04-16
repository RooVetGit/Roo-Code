# RooCode API Documentation

## Overview

The `API` class in `src/exports/api.ts` serves as the main interface for interacting with the RooCode extension. It implements the `RooCodeAPI` interface and extends `EventEmitter` with `RooCodeEvents`. This API provides a comprehensive set of methods for managing tasks, configurations, and communication between different components of the RooCode system.

The API is designed to:

1. Create, manage, and control tasks
2. Handle configuration settings
3. Emit and listen for events related to task lifecycle
4. Provide Inter-Process Communication (IPC) capabilities for external tools
5. Manage profiles for different API configurations

This API can be exposed to external tools, including command line interfaces, allowing for programmatic control of RooCode functionality outside the VS Code environment.

## Properties

### Private Properties

| Property          | Type                         | Description                                    |
| ----------------- | ---------------------------- | ---------------------------------------------- |
| `outputChannel`   | `vscode.OutputChannel`       | VS Code output channel for logging             |
| `sidebarProvider` | `ClineProvider`              | Provider for the sidebar UI                    |
| `context`         | `vscode.ExtensionContext`    | VS Code extension context                      |
| `ipc`             | `IpcServer`                  | Optional IPC server for external communication |
| `taskMap`         | `Map<string, ClineProvider>` | Maps task IDs to their providers               |
| `log`             | `Function`                   | Logging function                               |
| `logfile`         | `string`                     | Path to the log file                           |

## Methods

### Task Management

#### `startNewTask(options)`

Creates and starts a new task with the specified configuration.

**Parameters:**

- `options`: Object containing:
    - `configuration`: RooCodeSettings - Configuration for the task
    - `text`: string (optional) - Initial message for the task
    - `images`: string[] (optional) - Array of image data URIs
    - `newTab`: boolean (optional) - Whether to open in a new tab

**Returns:** Promise resolving to the task ID (string)

**Example:**

```typescript
const taskId = await api.startNewTask({
	configuration: mySettings,
	text: "Create a React component",
	newTab: true,
})
```

#### `resumeTask(taskId)`

Resumes a previously created task.

**Parameters:**

- `taskId`: string - ID of the task to resume

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.resumeTask("task-123")
```

#### `isTaskInHistory(taskId)`

Checks if a task exists in the history.

**Parameters:**

- `taskId`: string - ID of the task to check

**Returns:** Promise\<boolean\> - True if the task exists in history

**Example:**

```typescript
const exists = await api.isTaskInHistory("task-123")
```

#### `getCurrentTaskStack()`

Gets the current stack of tasks.

**Returns:** string[] - Array of task IDs

**Example:**

```typescript
const taskStack = api.getCurrentTaskStack()
```

#### `clearCurrentTask(lastMessage?)`

Clears the current task with an optional final message.

**Parameters:**

- `lastMessage`: string (optional) - Final message for the task

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.clearCurrentTask("Task completed successfully")
```

#### `cancelCurrentTask()`

Cancels the current task.

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.cancelCurrentTask()
```

#### `cancelTask(taskId)`

Cancels a specific task by ID.

**Parameters:**

- `taskId`: string - ID of the task to cancel

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.cancelTask("task-123")
```

### Communication

#### `sendMessage(text?, images?)`

Sends a message to the current task.

**Parameters:**

- `text`: string (optional) - Message text
- `images`: string[] (optional) - Array of image data URIs

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.sendMessage("Here's some additional information")
```

#### `pressPrimaryButton()`

Simulates pressing the primary button in the chat interface.

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.pressPrimaryButton()
```

#### `pressSecondaryButton()`

Simulates pressing the secondary button in the chat interface.

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.pressSecondaryButton()
```

### Configuration Management

#### `getConfiguration()`

Gets the current configuration.

**Returns:** RooCodeSettings - Current configuration

**Example:**

```typescript
const config = api.getConfiguration()
```

#### `setConfiguration(values)`

Sets the configuration.

**Parameters:**

- `values`: RooCodeSettings - Configuration values to set

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.setConfiguration({
	apiProvider: "openai",
	openAiModelId: "gpt-4",
})
```

### Profile Management

#### `createProfile(name)`

Creates a new API configuration profile.

**Parameters:**

- `name`: string - Name of the profile

**Returns:** Promise\<string\> - ID of the created profile

**Example:**

```typescript
const profileId = await api.createProfile("GPT-4 Profile")
```

#### `getProfiles()`

Gets a list of all profile names.

**Returns:** string[] - Array of profile names

**Example:**

```typescript
const profiles = api.getProfiles()
```

#### `setActiveProfile(name)`

Sets the active profile.

**Parameters:**

- `name`: string - Name of the profile to activate

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.setActiveProfile("GPT-4 Profile")
```

#### `getActiveProfile()`

Gets the name of the active profile.

**Returns:** string | undefined - Name of the active profile

**Example:**

```typescript
const activeProfile = api.getActiveProfile()
```

#### `deleteProfile(name)`

Deletes a profile.

**Parameters:**

- `name`: string - Name of the profile to delete

**Returns:** Promise\<void\>

**Example:**

```typescript
await api.deleteProfile("GPT-4 Profile")
```

### Status

#### `isReady()`

Checks if the API is ready to use.

**Returns:** boolean - True if the API is ready

**Example:**

```typescript
if (api.isReady()) {
	// API is ready to use
}
```

### Event System

The API extends EventEmitter and emits events defined in the `RooCodeEvents` interface. The events are defined in the `RooCodeEventName` enum:

```typescript
enum RooCodeEventName {
	Message = "message",
	TaskCreated = "taskCreated",
	TaskStarted = "taskStarted",
	TaskModeSwitched = "taskModeSwitched",
	TaskPaused = "taskPaused",
	TaskUnpaused = "taskUnpaused",
	TaskAskResponded = "taskAskResponded",
	TaskAborted = "taskAborted",
	TaskSpawned = "taskSpawned",
	TaskCompleted = "taskCompleted",
	TaskTokenUsageUpdated = "taskTokenUsageUpdated",
}
```

#### Event Listeners

You can listen for these events using the standard EventEmitter pattern:

```typescript
api.on(RooCodeEventName.TaskStarted, (taskId) => {
	console.log(`Task ${taskId} started`)
})

api.on(RooCodeEventName.Message, ({ taskId, message }) => {
	console.log(`Message from task ${taskId}: ${message.text}`)
})

api.on(RooCodeEventName.TaskCompleted, (taskId, usage) => {
	console.log(`Task ${taskId} completed with token usage: ${usage.totalTokensIn + usage.totalTokensOut}`)
})
```

#### Event Registration

The API registers event listeners for the Cline instance in the `registerListeners` method. These listeners forward events from the Cline to the API's event emitter, allowing external tools to listen for these events.

## IPC (Inter-Process Communication)

The API includes an optional IPC server that allows external processes to communicate with the RooCode extension. This is particularly useful for command line interfaces or other external tools.

### IPC Server

The IPC server is created if a `socketPath` is provided to the API constructor. It uses the `node-ipc` library to create a socket server that listens for connections and messages.

```typescript
const api = new API(outputChannel, provider, "/tmp/roocode.sock", true)
```

### Message Types

The IPC system defines several message types in the `IpcMessageType` enum:

```typescript
enum IpcMessageType {
	Connect = "Connect",
	Disconnect = "Disconnect",
	Ack = "Ack",
	TaskCommand = "TaskCommand",
	TaskEvent = "TaskEvent",
}
```

### Command Types

External tools can send commands to the API through the IPC server. The available commands are defined in the `TaskCommandName` enum:

```typescript
enum TaskCommandName {
	StartNewTask = "StartNewTask",
	CancelTask = "CancelTask",
	CloseTask = "CloseTask",
}
```

### Event Forwarding

The API forwards events to connected IPC clients using the `emit` method, which has been overridden to also broadcast the event to IPC clients:

```typescript
public override emit<K extends keyof RooCodeEvents>(
  eventName: K,
  ...args: K extends keyof RooCodeEvents ? RooCodeEvents[K] : never
) {
  const data = { eventName: eventName as RooCodeEventName, payload: args } as TaskEvent;
  this.ipc?.broadcast({ type: IpcMessageType.TaskEvent, origin: IpcOrigin.Server, data });
  return super.emit(eventName, ...args);
}
```

### IPC Client Example

Here's an example of how a command line interface might use the IPC client to communicate with the API:

```typescript
import ipc from "node-ipc"
import { IpcMessageType, IpcOrigin, TaskCommandName } from "./schemas/ipc"

// Connect to the IPC server
ipc.config.id = "roocode-cli"
ipc.config.silent = true
ipc.connectTo("roocode", "/tmp/roocode.sock", () => {
	// Listen for events
	ipc.of.roocode.on("message", (message) => {
		if (message.type === IpcMessageType.TaskEvent) {
			console.log(`Event: ${message.data.eventName}`, message.data.payload)
		}
	})

	// Send a command to start a new task
	ipc.of.roocode.emit("message", {
		type: IpcMessageType.TaskCommand,
		origin: IpcOrigin.Client,
		clientId: "roocode-cli",
		data: {
			commandName: TaskCommandName.StartNewTask,
			data: {
				configuration: {
					/* configuration */
				},
				text: "Create a React component",
			},
		},
	})
})
```

## Logging

The API includes a logging system that can log to both the VS Code output channel and a file. This is useful for debugging and tracking API usage.

```typescript
// Enable logging
const api = new API(outputChannel, provider, socketPath, true)

// Log file is created at the workspace path
// Default: path.join(getWorkspacePath(), "roo-code-messages.log")
```

## Command Line Interface Integration

To expose this API to a command line interface, you would typically:

1. Start the VS Code extension with IPC enabled
2. Create a CLI tool that connects to the IPC server
3. Implement commands in the CLI that send the appropriate IPC messages
4. Handle events from the IPC server to provide feedback to the user

### Example CLI Structure

```
roocode-cli/
├── bin/
│   └── roocode.js       # CLI entry point
├── src/
│   ├── commands/        # CLI commands
│   │   ├── start.js     # Start a new task
│   │   ├── cancel.js    # Cancel a task
│   │   └── ...
│   ├── ipc.js           # IPC client
│   └── index.js         # Main CLI logic
└── package.json
```

### Example Command Implementation

```typescript
// src/commands/start.js
import { ipcClient } from "../ipc"
import { IpcMessageType, IpcOrigin, TaskCommandName } from "../schemas/ipc"

export async function startTask(text, options) {
	return new Promise((resolve, reject) => {
		// Send the StartNewTask command
		ipcClient.emit("message", {
			type: IpcMessageType.TaskCommand,
			origin: IpcOrigin.Client,
			clientId: ipcClient.id,
			data: {
				commandName: TaskCommandName.StartNewTask,
				data: {
					configuration: options.config || {},
					text,
					newTab: options.newTab,
				},
			},
		})

		// Wait for the TaskCreated event
		const onTaskCreated = (message) => {
			if (message.type === IpcMessageType.TaskEvent && message.data.eventName === "taskCreated") {
				ipcClient.off("message", onTaskCreated)
				resolve(message.data.payload[0]) // Task ID
			}
		}

		ipcClient.on("message", onTaskCreated)

		// Timeout after 10 seconds
		setTimeout(() => {
			ipcClient.off("message", onTaskCreated)
			reject(new Error("Timeout waiting for task to be created"))
		}, 10000)
	})
}
```

## Conclusion

The RooCode API provides a powerful interface for interacting with the RooCode extension. It can be used to create and manage tasks, handle configuration, and communicate with external tools through IPC. This makes it an ideal candidate for integration with command line interfaces and other external tools.

By understanding the API's methods, events, and IPC capabilities, developers can create rich integrations that leverage the full power of RooCode from outside the VS Code environment.
