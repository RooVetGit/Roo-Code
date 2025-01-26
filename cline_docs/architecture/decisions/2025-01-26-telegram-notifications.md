# Telegram Notifications Integration

## Context

Users need to be notified and respond to Roo Code's requests when they are away from their computer. The system needs to handle two types of interactions:
1. Approval requests for actions (commands, file operations, etc.)
2. Open-ended questions requiring user input

## Decision

We will integrate Telegram as our notification provider because:
1. It has a robust API for two-way communication
2. It's widely available across platforms
3. It provides secure bot tokens for authentication
4. Messages can be formatted with Markdown
5. It has a simple webhook system for real-time updates

### Architecture

The notification system consists of several components:

1. **NotificationManager**: A singleton service that:
   - Manages notification providers (currently Telegram)
   - Routes notifications to appropriate providers
   - Handles response callbacks
   - Maintains provider configurations

2. **TelegramProvider**: Implements the NotificationProvider interface:
   - Sends formatted messages via Telegram Bot API
   - Uses ngrok for local webhook tunneling
   - Polls for responses when webhooks aren't available
   - Parses responses based on notification type

3. **NotificationSettings UI**: React component in the webview that:
   - Allows users to enable/disable notifications
   - Configures Telegram bot token and chat ID
   - Sets polling interval for responses

### Message Flow

1. **Approval Requests**:
   ```
   [Extension] -> NotificationManager -> TelegramProvider -> [Telegram]
   Message: "Approve command: git push"
   Response: "approve" or "deny"
   ```

2. **Questions**:
   ```
   [Extension] -> NotificationManager -> TelegramProvider -> [Telegram]
   Message: "What branch should I create?"
   Response: [Free-form text]
   ```

### Security Considerations

1. Bot tokens are stored securely in VSCode's global storage
2. All communication is encrypted via Telegram's API
3. Responses are validated against request IDs to prevent replay attacks
4. Only configured chat IDs can interact with the bot

## Implementation Notes

1. **Local Development**:
   - Uses ngrok for webhook tunneling
   - Falls back to polling if ngrok is not available

2. **Response Handling**:
   - Approval requests require exact "approve" or "deny" responses
   - Questions accept any text response
   - Responses are matched to requests via unique IDs

3. **Error Handling**:
   - Failed notifications are logged but don't block the system
   - Retries are implemented for transient failures
   - Users are notified of configuration issues

## Alternatives Considered

1. **Email Integration**:
   - Rejected due to complexity of handling responses
   - SMTP setup too cumbersome for users

2. **Custom Mobile App**:
   - Rejected due to development overhead
   - Distribution and maintenance challenges

3. **Desktop Notifications**:
   - Rejected as it doesn't solve the away-from-computer use case

## Future Considerations

1. Add support for multiple notification providers
2. Implement message priority levels
3. Add support for rich media responses (files, images)
4. Add support for notification grouping and threading