# Session Sharing

This document describes how to use the session sharing feature to export and import chat sessions.

## Exporting a Session

To export a session, click the "Share Task" button in the chat view. This will upload the session to the cloud and provide you with a shareable URL.

## Importing a Session

To import a session, you can either:

- Click the "Import Task" button in the chat view and paste the session URL or ID.
- Open a deep link in the format `vscode://<ext-id>/import-session?id=<session-id>`.

## Configuration

The base URL for the session sharing service can be configured in the following ways:

- **VS Code Setting:** `syntx.sessionSharing.baseUrl`
- **Environment Variable:** `SYNTX_SESSIONS_BASE_URL`
