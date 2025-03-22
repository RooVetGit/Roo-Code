# Benchmark Harness

## Get Started

[Install](https://docs.docker.com/desktop/) and run Docker Desktop.

Build a container to run the Roo Code benchmarks:

```sh
docker build -f Dockerfile -t roo-code-benchmark ..
```

## Local Debugging

Install nvm:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
# Reload shell.
nvm install
```

Install pnpm:

```sh
npm install --global corepack@latest
corepack enable pnpm
corepack use pnpm@latest-10
```

Install dependencies:

```sh
pnpm install
```

Configure database:

```sh
cp packages/server/.env.sample packages/server/.env
# Update BENCHMARKS_DB_PATH as needed in `packages/server/.env`.
pnpm --filter @benchmark/db db:push
```

Run the web app:

```sh
pnpm web
```

Run an exercise via the cli:

```sh
pnpm cli run [cpp|go|java|javascript|python|rust|all] [<exercise>|all]
```

## Extension Runner

The extension runner (`@benchmark/runner`) is responsible for spawning VSCode instances and running Roo Code on the benchmark exercises. It leverages the [`@vscode/test-electron`](https://github.com/Microsoft/vscode-test) package to do this.

VS Code provides two CLI parameters for running extension tests, `--extensionDevelopmentPath` and `--extensionTestsPath`.

For example:

```sh
# - Launches VS Code Extension Host
# - Loads the extension at <EXTENSION-ROOT-PATH>
# - Executes the test runner script at <TEST-RUNNER-SCRIPT-PATH>
code \
  --extensionDevelopmentPath=<EXTENSION-ROOT-PATH> \
  --extensionTestsPath=<TEST-RUNNER-SCRIPT-PATH>
```

If you make extension code changes then you need to re-build it so that `extensionDevelopmentPath` has the latest version transpiled:

```sh
pnpm build:extension
```

If you make changes to `@benchmark/runner` or any of its dependencies then you should rebuild it:

```sh
pnpm build:runner
```
