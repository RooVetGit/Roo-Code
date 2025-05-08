# Roo Code Evals

A comprehensive framework for evaluating the performance of the Roo Code extension on programming exercises across multiple languages.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup Process](#setup-process)
    - [First-Time Setup](#first-time-setup)
    - [Already Installed](#already-installed)
- [Running Evaluations](#running-evaluations)
    - [Using the Web UI](#using-the-web-ui)
    - [Using the CLI](#using-the-cli)
- [Understanding Results](#understanding-results)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

## Overview

Roo Code Evals is a system for running automated evaluations of the Roo Code extension against programming exercises in various languages. It helps measure the performance, accuracy, and efficiency of the AI coding assistant across different programming tasks.

The system supports evaluations in:

- Go
- Java
- JavaScript
- Python
- Rust

## Architecture

The evals system consists of several interconnected components:

1. **CLI Application** (`apps/cli`):

    - Launches VS Code instances with the Roo Code extension
    - Sends prompts to the extension
    - Collects results and metrics
    - Runs unit tests to verify solutions

2. **Web UI** (`apps/web`):

    - Next.js application for viewing and managing evaluation runs
    - Displays detailed metrics and results
    - Allows creating new evaluation runs with custom settings

3. **Database** (`packages/db`):

    - SQLite database for storing evaluation data
    - Tracks runs, tasks, metrics, and errors
    - Located at `/tmp/evals.db` by default

4. **IPC System** (`packages/ipc`):

    - Facilitates communication between processes
    - Uses Unix sockets for local communication

5. **Exercises Repository**:
    - Separate Git repository containing exercise prompts and test cases
    - Cloned during setup to a location outside the main Roo Code repository
    - Located at `../../evals` relative to the Roo Code repository

## Setup Process

### First-Time Setup

If you're setting up the evals system for the first time:

1. **Clone the Roo Code repository**:

    ```sh
    git clone https://github.com/RooVetGit/Roo-Code.git
    cd Roo-Code
    ```

2. **Run the setup script**:

    ```sh
    cd evals
    ./scripts/setup.sh
    ```

    This script will:

    - Check for Node.js v20.18.1+ (and install/configure it if needed)
    - Launch the interactive setup.mjs script which will:
        - Check for and install required dependencies (Python, Go, Rust, Java)
        - Install package managers (pnpm, asdf, Homebrew if on macOS)
        - Clone the exercises repository to `../../evals`
        - Set up the .env file with your OpenRouter API key
        - Create and sync the database
        - Build and install the Roo Code extension if needed
        - Install required VS Code extensions
        - Offer to start the web UI immediately

3. **If you chose to start the web UI during setup**:
    - The web server will be running at http://localhost:3000
    - You can access it in your browser to create and view evaluation runs

### Already Installed

If you've already completed the setup process and want to run the evals system again:

1. **Navigate to the evals directory**:

    ```sh
    cd /path/to/Roo-Code/evals
    ```

2. **Start the web UI**:

    ```sh
    pnpm web
    ```

3. **Access the web interface**:
    - Open http://localhost:3000 in your browser

## Running Evaluations

### Using the Web UI

1. **Start the web UI** (if not already running):

    ```sh
    cd /path/to/Roo-Code/evals
    pnpm web
    ```

2. **Create a new evaluation run**:

    - Click the "New Evaluation Run" button (rocket icon)
    - Select a model from the OpenRouter models list
    - Choose evaluation settings:
        - **All**: Run all exercises for all languages
        - **Some**: Select specific language/exercise combinations
    - Set concurrency level (how many evaluations to run in parallel)
    - Add an optional description
    - Click "Launch" to start the evaluation

3. **Monitor progress**:

    - The run details page shows real-time progress of each task
    - Metrics are updated as tasks complete
    - You can navigate away and come back later - the evaluation continues in the background

4. **View results**:

    - When tasks complete, you'll see pass/fail status
    - Detailed metrics include:
        - Token usage (input, output, context)
        - Cost
        - Duration
        - Tool usage statistics

5. **Export results**:
    - Use the "Export CSV" button to download results for further analysis

### Using the CLI

For more advanced usage or automation, you can use the CLI directly:

1. **Run a specific exercise**:

    ```sh
    cd /path/to/Roo-Code/evals
    pnpm cli run javascript fibonacci
    ```

2. **Run all exercises for a language**:

    ```sh
    pnpm cli run python all
    ```

3. **Run all exercises for all languages**:

    ```sh
    pnpm cli run all
    ```

4. **Resume a previous run**:
    ```sh
    pnpm cli run --runId=123
    ```

## Understanding Results

The evaluation results provide several key metrics:

- **Pass/Fail Status**: Whether the solution passed the unit tests
- **Token Usage**:
    - Tokens In: Prompt size in tokens
    - Tokens Out: Response size in tokens
    - Context Tokens: Size of context window used
- **Cost**: Estimated cost of the API calls
- **Duration**: Time taken to complete the task
- **Tool Usage**: Statistics on tool usage (e.g., apply_diff success rate)

These metrics help you understand:

- How effectively the model solves different types of problems
- The efficiency of the solution process
- Cost implications of different models and settings

## Project Structure

```
evals/
├── apps/
│   ├── cli/            # Command-line interface for running evaluations
│   │   └── src/        # CLI source code
│   └── web/            # Web interface for viewing results
│       └── src/        # Next.js web application
├── packages/
│   ├── db/             # Database schema and queries
│   ├── ipc/            # Inter-process communication
│   ├── lib/            # Shared utilities
│   └── types/          # TypeScript type definitions
├── scripts/            # Setup and utility scripts
│   ├── setup.sh        # Main setup script (entry point)
│   └── setup.mjs       # Node.js setup script (called by setup.sh)
└── README.md           # This file
```

The exercises repository (cloned during setup) is located at `../../evals` relative to this directory.

## Troubleshooting

### Common Issues

1. **Web UI not starting**:

    - Check if another process is using port 3000
    - Ensure you're in the correct directory (`/path/to/Roo-Code/evals`)
    - Try running `pnpm install` to ensure dependencies are installed

2. **VS Code not launching during evaluation**:

    - Ensure VS Code is installed and the `code` command is in your PATH
    - Check if VS Code is already running with too many windows
    - Try restarting VS Code

3. **Database errors**:

    - Check that the database file exists at `/tmp/evals.db`
    - Ensure it has the correct permissions
    - Try running `pnpm --filter @evals/db db:push` to recreate the schema

4. **API key issues**:

    - Verify your OpenRouter API key is correctly set in the `.env` file
    - Check if the key has sufficient credits
    - Try validating the key with a direct API call

5. **Missing exercises**:
    - Ensure the exercises repository was cloned correctly to `../../evals`
    - Check if you have the latest version with `git -C ../../evals pull`

### Logs

When troubleshooting, check these logs:

- **CLI logs**: Output in the terminal where you ran the CLI
- **Web logs**:
    - Server logs in the terminal where you ran `pnpm web`
    - Browser console logs (F12 in most browsers)
- **VS Code logs**: Help > Toggle Developer Tools in VS Code

## Advanced Usage

### Custom Settings

You can import custom Roo Code settings when creating a new evaluation run:

1. Export your settings from VS Code
2. Click "Import Settings" in the new run page
3. Select your exported settings file

### Running Specific Exercises

To run only specific exercises:

1. In the web UI, select "Some" instead of "All" in the exercises dropdown
2. Select the specific language/exercise combinations you want to evaluate

### Comparing Models

To compare different models:

1. Create separate runs with different models
2. View the results side by side
3. Export the results to CSV for detailed comparison

### Modifying Exercises

If you want to create or modify exercises:

1. Navigate to the exercises repository (`../../evals`)
2. Add or modify exercises following the existing structure
3. Commit and push your changes if you want to share them
