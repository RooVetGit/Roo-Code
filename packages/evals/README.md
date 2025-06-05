# Run Roo Code Evals

### Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/)
- [git](https://git-scm.com/)
- That's it!

### Setup

Clone the Roo Code repo:

```sh
git clone https://github.com/RooCodeInc/Roo-Code.git
cd Roo-Code
```

Add your OpenRouter API key:

```sh
echo "OPENROUTER_API_KEY=sk-or-v1-[...]" > packages/evals/.env.local
```

### Run

Start the evals service:

```sh
docker compose -f packages/evals/docker-compose.yml --profile server --profile runner up --build --scale runner=0
```

Navigate to [localhost:3000](http://localhost:3000/) in your browser.

## Advanced Usage / Debugging

The evals system runs VS Code headlessly in Docker containers for consistent, reproducible environments. While this design ensures reliability, it can make debugging more challenging. For debugging purposes, you can run the system locally on macOS, though this approach is less reliable due to hardware and environment variability.

To configure your MacOS system to run evals locally, execute the setup script:

```sh
cd packages/evals && ./scripts/setup.sh
```

The setup script does the following:

- Installs development tools: Homebrew, asdf, GitHub CLI, pnpm
- Installs programming languages: Node.js 20.19.2, Python 3.13.2, Go 1.24.2, Rust 1.85.1, Java 17
- Sets up VS Code with required extensions
- Configures Docker services (PostgreSQL, Redis)
- Clones/updates the evals repository
- Creates and migrates a Postgres database
- Prompts for an OpenRouter API key to add to `.env.local`
- Optionally builds and installs the Roo Code extension from source
