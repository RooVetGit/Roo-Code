# Run Roo Code Evals

## Get Started

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
cd packages/evals && docker compose --profile server up
```

Navigate to [localhost:3000](http://localhost:3000/) in your browser.

## Advanced Usage / Debugging

The evals system runs VS Code headlessly in Docker containers for consistent, reproducible environments. While this design ensures reliability, it can make debugging more challenging. For debugging purposes, you can run the system locally on macOS, though this approach is less reliable due to hardware and environment variability.

To configure your MacOS system to run evals locally, execute the setup script:

```sh
cd packages/evals && ./scripts/setup.sh
```
