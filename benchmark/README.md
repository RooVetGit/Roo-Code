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
