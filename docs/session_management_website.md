# Session Sharing Platform: Technical Specification

## 1. Overview

This document provides a detailed technical specification for building a web platform that enables developers to share their coding sessions from within the SyntX VS Code extension. The platform will serve as a central repository for these sessions, allowing them to be viewed and imported by other developers.

This document is intended for the development team responsible for building the web platform and assumes a working knowledge of web development technologies, particularly Next.js.

## 2. System Architecture

The system consists of two main components:

- **SyntX VS Code Extension (Client)**: The extension is responsible for capturing the session data, serializing it, and communicating with the web platform's API.
- **Web Platform (Server)**: A Next.js application responsible for storing, rendering, and serving session data.

The two components will communicate via a RESTful API.

## 3. Data Schema

The core data model for a shared session is defined by the `SerializedSession` schema. This schema ensures data consistency between the VS Code extension and the web platform.

The schema consists of the following fields:

- `version` (string): The version of the schema. This is important for handling future migrations.
- `task` (HistoryItem): The main task object, which contains the initial prompt and other metadata.
- `messages` (array of ClineMessage): An array of all the messages in the chat history, including user prompts, AI responses, and tool interactions.

Refer to the `src/services/session/schema.ts` file for the detailed Zod schema definition.

## 4. Web Platform: Detailed Specifications

The web platform will be a Next.js application with the following features and technical specifications.

### 4.1. Technology Stack

- **Framework**: Next.js (with App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MongoDB (using Mongoose for schema validation and modeling)
- **Deployment**: Vercel

### 4.2. API Endpoints

The following API endpoints will be implemented as Next.js API Routes.

#### 4.2.1. `POST /api/sessions`

- **Description**: Creates a new session.
- **Request Body**: A JSON object that conforms to the `SerializedSession` schema.
- **Headers**:
    - `Syntx-Api-Key` (string, **required**): The API key for authenticating the user.
- **Validation**:
    - The request body will be validated against the `SerializedSessionSchema` using Zod.
    - The `Syntx-Api-Key` header must be present and valid.
- **Logic**:
    1.  Validate the `Syntx-Api-Key` against a list of valid keys. If the key is invalid or missing, return a `401 Unauthorized` error.
    2.  Generate a unique ID for the session (e.g., using a library like `nanoid`).
    3.  Store the session data in the MongoDB database.
    4.  Return a JSON response with the session ID and a shareable URL.
- **Response**:
    - **Success (201 Created)**: `{ "id": "<session-id>", "url": "https://<your-domain>/session/<session-id>" }`
    - **Error (400 Bad Request)**: If the request body is invalid.
    - **Error (401 Unauthorized)**: If the `Syntx-Api-Key` is missing or invalid.
    - **Error (500 Internal Server Error)**: For any other errors.

#### 4.2.2. `GET /api/sessions/:id`

- **Description**: Retrieves a session by its ID.
- **URL Parameters**:
    - `id` (string): The unique ID of the session.
- **Logic**:
    1.  Fetch the session with the specified ID from the MongoDB database.
    2.  If the session is not found, return a 404 error.
    3.  Return the session data as JSON.
- **Response**:
    - **Success (200 OK)**: The `SerializedSession` object.
    - **Error (404 Not Found)**: If the session with the specified ID does not exist.
    - **Error (500 Internal Server Error)**: For any other errors.

### 4.3. Frontend Pages

The following pages will be implemented as Next.js pages.

#### 4.3.1. `app/session/[id]/page.tsx`

- **Description**: Displays a single session.
- **URL Parameters**:
    - `id` (string): The unique ID of the session.
- **Logic**:
    1.  Fetch the session data from the `/api/sessions/:id` endpoint on the server-side.
    2.  If the session is not found, render a 404 page.
    3.  Render the session content in a user-friendly format.
        - The main task prompt should be clearly displayed at the top.
        - The chat messages should be rendered in a conversational format, similar to the VS Code extension's UI.
        - Code snippets within messages should be rendered with syntax highlighting (using a library like `react-syntax-highlighter`).
    4.  Include an "Import to VS Code" button that triggers a deep link.

#### 4.3.2. Deep Linking

The "Import to VS Code" button will link to a custom URI scheme in the following format:

`vscode://<your-extension-id>/import-session?id=<session-id>`

The SyntX VS Code extension will have a `UriHandler` registered to handle this URI scheme. When the user clicks the link, the handler will:

1.  Parse the URI to extract the session ID.
2.  Make a `GET` request to the `/api/sessions/:id` endpoint to fetch the session data.
3.  Import the session into the user's VS Code environment.

## 5. Implementation Plan

The development of the web platform will be carried out in the following phases:

1.  **Phase 1: Project Setup & API Development**

    - Initialize the Next.js project.
    - Set up the MongoDB database and connect it to the application.
    - Implement the `POST /api/sessions` and `GET /api/sessions/:id` API endpoints.
    - Write unit and integration tests for the API endpoints.

2.  **Phase 2: Frontend Development**

    - Implement the `app/session/[id]/page.tsx` page.
    - Implement the UI for displaying the session content, including syntax highlighting.
    - Implement the "Import to VS Code" button with the correct deep link.

3.  **Phase 3: Deployment & Integration**
    - Deploy the application to Vercel.
    - Configure the production environment variables.
    - Integrate the web platform with the SyntX VS Code extension.

## 6. Future Enhancements

The following features can be added in future iterations of the platform:

- **User Authentication**: Allow users to sign up and log in using OAuth providers like GitHub.
- **Session Management**: Provide a dashboard for authenticated users to view and manage their shared sessions.
- **Private Sharing**: Allow users to share sessions privately with specific users or teams.
- **Collaboration**: Implement real-time collaboration features, such as commenting on sessions.
