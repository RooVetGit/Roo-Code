<div align="center">
<h1>Seawolf</h1>
<p>An AI-powered autonomous coding agent for your editor</p>
</div>

**Seawolf** is an AI-powered autonomous coding agent that lives in your editor. It can:

- Communicate in natural language
- Read and write files directly in your workspace
- Run terminal commands
- Automate browser actions
- Integrate with any OpenAI-compatible or custom API/model
- Adapt its capabilities through **Custom Modes**

Whether you are seeking a flexible coding partner, a system architect, or specialized roles like a QA engineer or product manager, Seawolf can help you build software more efficiently.

Check out the [CHANGELOG](CHANGELOG.md) for detailed updates and fixes.

---

## What Can Seawolf Do?

- **Generate Code** from natural language descriptions
- **Refactor & Debug** existing code
- **Write & Update** documentation
- **Answer Questions** about your codebase
- **Automate** repetitive tasks
- **Create** new files and projects

## Quick Start

1. Install Seawolf from the VS Code Marketplace
2. Connect your preferred AI provider
3. Start your first task

## Key Features

### Multiple Modes

Seawolf adapts to your needs with specialized modes:

- **Code Mode:** For general-purpose coding tasks
- **Architect Mode:** For planning and technical leadership
- **Ask Mode:** For answering questions and providing information
- **Debug Mode:** For systematic problem diagnosis
- **Custom Modes:** Create unlimited specialized personas for security auditing, performance optimization, documentation, or any other task

### Smart Tools

Seawolf comes with powerful tools that can:

- Read and write files in your project
- Execute commands in your VS Code terminal
- Control a web browser
- Use external tools via MCP (Model Context Protocol)

MCP extends Seawolf capabilities by allowing you to add unlimited custom tools. Integrate with external APIs, connect to databases, or create specialized development tools - MCP provides the framework to expand Seawolf functionality to meet your specific needs.

### Customization

Make Seawolf work your way with:

- Custom Instructions for personalized behavior
- Custom Modes for specialized tasks
- Local Models for offline use
- Auto-Approval Settings for faster workflows

---

## Local Setup & Development

1. **Clone** the repo:

    git clone https://github.com/Opensourceful/Seawolf.git

2. **Install dependencies**:

    npm run install:all

3. **Start the webview (Vite/React app with HMR)**:

    npm run dev

4. **Debug**:
   Press F5 (or **Run > Start Debugging**) in VSCode to open a new session with Seawolf loaded.

Changes to the webview will appear immediately. Changes to the core extension will require a restart of the extension host.

Alternatively you can build a .vsix and install it directly in VSCode:

    npm run build

A .vsix file will appear in the bin/ directory which can be installed with:

    code --install-extension bin/Seawolf-<version>.vsix

We use [changesets](https://github.com/changesets/changesets) for versioning and publishing. Check our CHANGELOG.md for release notes.

---

## License

[Apache 2.0](./LICENSE)
