# Settings Webview Migration

This folder contains a new implementation of the Roo Code settings panel using React, TypeScript, Vite, Vitest, React Router, and Fluent UI. The goal is to gradually migrate all settings from the current implementation in `@webview-ui/src/components/settings/SettingsView.tsx` to this new implementation.

## Architecture

- **React**: UI library
- **TypeScript**: Type safety
- **Vite**: Fast development and building
- **Vitest**: Testing framework
- **React Router**: Navigation
- **Fluent UI**: UI component library

## Development Process

1. Set up the project structure ✅
2. Create a basic UI with a two-column layout (1/3 for navigation, 2/3 for content)
3. Implement communication with the extension
4. Migrate settings sections one by one
5. Run both implementations in parallel until migration is complete
6. Switch over to the new implementation

## Settings Migration Checklist

### General Settings

- [ ] API Configuration Manager
- [ ] API Options
- [ ] Language Settings

### Permission Settings

- [ ] Auto Approve Settings
    - [ ] Read Operations
    - [ ] Write Operations
    - [ ] Execute Operations
    - [ ] Browser Operations
    - [ ] MCP Operations
    - [ ] Mode Switch Operations
    - [ ] Subtask Operations
    - [ ] Allowed Commands

### Feature Settings

- [ ] Browser Settings
    - [ ] Browser Tool
    - [ ] Viewport Size
    - [ ] Screenshot Quality
    - [ ] Remote Browser
- [ ] Checkpoint Settings
    - [ ] Enable Checkpoints
    - [ ] Checkpoint Storage
- [ ] Notification Settings
    - [ ] Text-to-Speech
    - [ ] Sound Effects
- [ ] Context Management Settings
    - [ ] Max Open Tabs Context
    - [ ] Max Workspace Files
    - [ ] Show .rooignore Files
    - [ ] Max Read File Line
- [ ] Terminal Settings
    - [ ] Terminal Output Line Limit
    - [ ] Terminal Shell Integration Timeout

### Advanced Settings

- [ ] Advanced Settings
    - [ ] Diff Enabled
    - [ ] Fuzzy Match Threshold
- [ ] Experimental Settings
    - [ ] Various Experimental Features

### About

- [ ] Version Information
- [ ] Telemetry Settings

## How to Run

Development mode:

```
npm run dev
```

Build:

```
npm run build
```

Test:

```
npm run test
```
