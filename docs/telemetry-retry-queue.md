# Telemetry Retry Queue

This document describes the persistent retry queue system for failed telemetry events in Roo Code.

## Overview

The telemetry retry queue ensures that telemetry events are never lost due to temporary network issues, server downtime, or other connectivity problems. It provides a robust delivery system with the following features:

- **Persistent Storage**: Events are stored locally using VSCode's globalState API and survive extension restarts
- **Exponential Backoff**: Failed events are retried with increasing delays to avoid overwhelming the server
- **Priority Handling**: Critical events (errors, crashes) are prioritized over routine analytics
- **Connection Monitoring**: Tracks connection status and provides user feedback
- **Configurable Behavior**: Users can control retry behavior through VSCode settings

## Architecture

### Components

1. **TelemetryRetryQueue**: Core queue management with persistent storage
2. **ResilientTelemetryClient**: Wrapper that adds retry functionality to any TelemetryClient
3. **Configuration Settings**: VSCode settings for user control
4. **Status Monitoring**: Visual feedback through status bar and notifications

### Flow

```
Telemetry Event → Immediate Send Attempt → Success? → Done
                                        ↓ Failure
                                   Add to Retry Queue
                                        ↓
                              Periodic Retry Processing
                                        ↓
                                Exponential Backoff
                                        ↓
                              Success or Max Retries
```

## Configuration

### VSCode Settings

Users can configure the retry behavior through the following settings:

- `roo-cline.telemetryRetryEnabled` (boolean, default: true)
    - Enable/disable the retry queue system
- `roo-cline.telemetryRetryMaxRetries` (number, default: 5, range: 0-10)
    - Maximum number of retry attempts per event
- `roo-cline.telemetryRetryBaseDelay` (number, default: 1000ms, range: 100-10000ms)
    - Base delay between retry attempts (exponential backoff)
- `roo-cline.telemetryRetryMaxDelay` (number, default: 300000ms, range: 1000-600000ms)
    - Maximum delay between retry attempts (5 minutes default)
- `roo-cline.telemetryRetryQueueSize` (number, default: 1000, range: 10-10000)
    - Maximum number of events to queue for retry
- `roo-cline.telemetryRetryNotifications` (boolean, default: true)
    - Show notifications when connection issues are detected

### Programmatic Configuration

```typescript
import { TelemetryRetryQueue, RetryQueueConfig } from "@roo-code/telemetry"

const config: Partial<RetryQueueConfig> = {
	maxRetries: 3,
	baseDelayMs: 2000,
	maxDelayMs: 60000,
	maxQueueSize: 500,
	batchSize: 5,
	enableNotifications: false,
}

const retryQueue = new TelemetryRetryQueue(context, config)
```

## Usage

### Basic Usage

The retry queue is automatically integrated into the telemetry system. No additional code is required for basic functionality:

```typescript
// This automatically uses the retry queue if the send fails
TelemetryService.instance.captureTaskCreated("task-123")
```

### Advanced Usage

For custom telemetry clients, wrap them with `ResilientTelemetryClient`:

```typescript
import { ResilientTelemetryClient } from "@roo-code/telemetry"

const originalClient = new MyTelemetryClient()
const resilientClient = new ResilientTelemetryClient(originalClient, context)

// Register with telemetry service
TelemetryService.instance.register(resilientClient)
```

### Manual Queue Management

```typescript
// Get queue status
const status = await resilientClient.getQueueStatus()
console.log(`Queue size: ${status.queueSize}`)
console.log(`Connected: ${status.connectionStatus.isConnected}`)

// Manually trigger retry
await resilientClient.retryNow()

// Clear queue
await resilientClient.clearQueue()

// Update configuration
resilientClient.updateRetryConfig({ maxRetries: 10 })
```

## Priority System

Events are automatically prioritized based on their importance:

### High Priority Events

- `SCHEMA_VALIDATION_ERROR`
- `DIFF_APPLICATION_ERROR`
- `SHELL_INTEGRATION_ERROR`
- `CONSECUTIVE_MISTAKE_ERROR`

### Normal Priority Events

- All other telemetry events (task creation, completion, etc.)

High priority events are:

- Processed before normal priority events
- Retained longer when queue size limits are reached
- Given preference during batch processing

## Storage

### Persistence

Events are stored in VSCode's `globalState` under the key `telemetryRetryQueue`. This ensures:

- Data survives extension restarts
- Data survives VSCode crashes
- Data is automatically cleaned up when the extension is uninstalled

### Storage Format

```typescript
interface QueuedTelemetryEvent {
	id: string // Unique identifier
	event: TelemetryEvent // Original event data
	timestamp: number // When event was first queued
	retryCount: number // Number of retry attempts
	nextRetryAt: number // When to retry next
	priority: "high" | "normal" // Event priority
}
```

### Size Management

- Queue size is limited by `maxQueueSize` setting
- When limit is reached, oldest normal priority events are removed first
- High priority events are preserved longer
- Automatic cleanup of successfully sent events

## Retry Logic

### Exponential Backoff

Retry delays follow an exponential backoff pattern:

```
delay = min(baseDelayMs * 2^retryCount, maxDelayMs)
```

Example with default settings (baseDelayMs=1000ms, maxDelayMs=300000ms):

- Retry 1: 1 second
- Retry 2: 2 seconds
- Retry 3: 4 seconds
- Retry 4: 8 seconds
- Retry 5: 16 seconds
- Further retries: 5 minutes (maxDelayMs)

### Batch Processing

- Events are processed in batches to improve efficiency
- Default batch size: 10 events
- Batches are processed every 30 seconds
- Failed events in a batch are individually rescheduled

### Failure Handling

- Temporary failures (network errors): Event is rescheduled for retry
- Permanent failures (authentication errors): Event may be dropped
- Max retries exceeded: Event is removed from queue
- Invalid events: Event is dropped immediately

## User Interface

### Status Bar

When events are queued, a status bar item appears showing:

- Queue size
- Connection status (connected/disconnected)
- Click to view queue details

### Notifications

When enabled, users receive notifications for:

- Prolonged disconnection (>5 minutes)
- Large queue buildup
- Option to manually trigger retry or disable notifications

### Commands

The following commands are available:

- `roo-code.telemetry.showQueue`: Display queue status and management options
- `roo-code.telemetry.retryNow`: Manually trigger retry processing
- `roo-code.telemetry.clearQueue`: Clear all queued events

## Monitoring

### Connection Status

The system tracks:

- `isConnected`: Current connection state
- `lastSuccessfulSend`: Timestamp of last successful telemetry send
- `consecutiveFailures`: Number of consecutive send failures

Connection is considered lost after 3 consecutive failures.

### Metrics

Internal metrics tracked:

- Queue size over time
- Retry success/failure rates
- Average retry delays
- Event priority distribution

## Error Handling

### Graceful Degradation

- If retry queue initialization fails, telemetry continues without retry
- Storage errors are logged but don't prevent telemetry operation
- Invalid queue data is automatically cleaned up

### Error Logging

Errors are logged with appropriate levels:

- Warnings: Temporary failures, retry attempts
- Errors: Persistent failures, configuration issues
- Info: Successful operations, queue status changes

## Testing

### Unit Tests

Comprehensive test coverage includes:

- Queue operations (enqueue, dequeue, prioritization)
- Retry logic (exponential backoff, max retries)
- Storage persistence
- Configuration handling
- Error scenarios

### Integration Tests

- End-to-end telemetry flow with retry
- VSCode extension integration
- Configuration changes
- Network failure simulation

## Performance Considerations

### Memory Usage

- Queue size is limited to prevent unbounded growth
- Events are stored efficiently with minimal metadata
- Automatic cleanup of processed events

### CPU Usage

- Retry processing runs on a 30-second interval
- Batch processing minimizes overhead
- Exponential backoff reduces server load

### Network Usage

- Failed events are not retried immediately
- Batch processing reduces connection overhead
- Exponential backoff prevents server overload

## Security

### Data Protection

- Telemetry events may contain sensitive information
- Events are stored locally only
- No additional network exposure beyond normal telemetry

### Privacy

- Retry queue respects user telemetry preferences
- Queue is cleared when telemetry is disabled
- No additional data collection beyond original events

## Troubleshooting

### Common Issues

1. **Queue not working**: Check `telemetryRetryEnabled` setting
2. **Too many notifications**: Disable `telemetryRetryNotifications`
3. **Queue growing too large**: Reduce `telemetryRetryQueueSize`
4. **Slow retry processing**: Reduce `telemetryRetryBaseDelay`

### Debugging

Enable debug logging by setting the telemetry client debug flag:

```typescript
const client = new PostHogTelemetryClient(true) // Enable debug
```

### Queue Inspection

Use the command palette:

1. Open Command Palette (Ctrl/Cmd + Shift + P)
2. Run "Roo Code: Show Telemetry Queue"
3. View queue status and management options

## Migration

### Existing Installations

The retry queue is automatically enabled for existing installations with default settings. No user action is required.

### Upgrading

When upgrading from versions without retry queue:

- Existing telemetry behavior is preserved
- Retry queue is enabled with default settings
- Users can disable via settings if desired

## Future Enhancements

Potential future improvements:

- Configurable retry strategies (linear, custom)
- Queue analytics and reporting
- Network condition detection
- Intelligent batching based on connection quality
- Event compression for large queues
