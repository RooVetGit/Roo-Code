# Riko

**[Code of Conduct](link-to-your-code-of-conduct.md) • [Contributing](link-to-your-contributing.md) • [License](link-to-your-license.md) • [Security](link-to-your-security.md)**

---

## Riko: Spec-Driven Development for Roo Code

An extension for the Roo codebase that integrates a native, AI-powered, **spec-driven development** workflow.

**Project Status:** In Development

---

**Riko** enhances the Roo application by embedding a systematic process for planning, designing, and implementing software features. By transforming ideas into clear specifications *before* writing code, Riko helps developers and teams build the right thing, correctly.

It formalizes the development lifecycle into three distinct phases:
* **Requirements**: Define what needs to be built with clear, testable user stories.
* **Design**: Create a comprehensive technical blueprint for the feature.
* **Tasks**: Break down the design into an actionable, step-by-step implementation plan.

This structured approach ensures clarity, improves collaboration, and provides a solid foundation for AI-assisted coding.

### What Can Riko Do?

🚀 **Plan Features Systematically** from a simple idea to a full specification.
🔧 **Generate Technical Designs** that align perfectly with approved requirements.
📝 **Create Actionable Task Lists** to guide a smooth implementation process.
🤔 **Ensure Code Aligns with Plans** by providing a clear, documented source of truth.
🔄 **Streamline AI Collaboration** by giving AI assistants the context they need.

---

### Quick Start

1.  Navigate to the **"Specs"** tab in the Roo sidebar.
2.  Click the **"Create New Spec"** button.
3.  Follow the guided, three-phase workflow to build your feature plan.

---

### Key Features

#### Spec-Driven Workflow
Riko introduces a structured, three-phase process to guide development:
* **Requirements Phase**: Capture user stories and acceptance criteria in the EARS format.
* **Design Phase**: Document system architecture, data models, and API interfaces.
* **Tasks Phase**: Break down the design into a clear, sequential implementation plan.

#### Spec Management Dashboard
A centralized view to manage all your feature specifications. See the status of each spec at a glance, create new specs, and navigate to the editor.

#### Multi-Phase Editor
A guided editor that walks you through each phase of the spec process. The UI is designed to help you focus on the current stage while providing context from previous phases.

#### Seamless Roo Integration
Riko is not a separate tool; it's a native feature module.
* **UI Consistency**: Built using Roo's existing Svelte components and Tailwind CSS design system.
* **Backend Integration**: Natively extends Roo's Express.js backend and uses the same Drizzle ORM and database.
* **Shared Authentication**: Securely uses Roo's existing user authentication and authorization.

---

### Resources

* **Documentation**: (Coming Soon)
* **Community**: Join the main [Roo Code Discord](link-to-discord) for discussions.
* **GitHub**: Report [issues](https://github.com/aaronmrosenthal/riko/issues) or request [features](https://github.com/aaronmrosenthal/riko/issues).

---

### Local Setup & Development

Clone the repo:
```bash
git clone [https://github.com/aaronmrosenthal/riko.git](https://github.com/aaronmrosenthal/riko.git)
```

Install dependencies:

```bash
pnpm install
```

#### Run the extension:

There are several ways to run the Riko extension:

**Development Mode (F5)**

For active development, use VSCode's built-in debugging:

1.  Press **F5** (or go to `Run` → `Start Debugging`) in VSCode. This will open a new VSCode window with the Riko extension running.
2.  Changes to the webview will appear immediately.
3.  Changes to the core extension will also hot reload automatically.

**Manual VSIX Installation**

If you prefer to install the VSIX package manually:

1.  First, build the VSIX package:
    ```bash
    pnpm vsix
    ```
2.  A `.vsix` file will be generated in the `bin/` directory.
3.  Install it manually using the VSCode CLI:
    ```bash
    code --install-extension bin/riko-cline-<version>.vsix
    ```

-----

### Disclaimer

This is a fork of the Roo Code project, intended for developing the Riko feature. All original rights and licenses from the Roo Code repository apply. You assume all risks associated with the use of this software.
