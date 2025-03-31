# Benchmark Harness

## Get Started

Clone the Roo Code repo:

```sh
git clone https://github.com/RooVetGit/Roo-Code.git
```

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

Build the Roo Code extension:

```sh
npm run install:all
npx vsce package --out bin/roo-code-latest.vsix
```

[Install](https://docs.docker.com/desktop/) and run Docker Desktop.

Build a container to run the Roo Code evals:

```sh
cd benchmark
pnpm install
pnpm docker:start
```

Navigation to [localhost:3000](http://localhost:3000/) in your browser.
