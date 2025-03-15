# Benchmark Harness

Configure ENV vars (OpenRouter, PostHog, etc):

```sh
cp .env.local.sample .env.local
# Update ENV vars as needed.
```

Build and run a Docker image with the development environment needed to run the
benchmarks (C++, Go, Java, Node.js, Python & Rust):

```sh
npm run docker:start
```

Run an exercise:

```sh
npm run docker:benchmark -- -e exercises/javascript/binary
```

Use the cli to select and run an exercise:

```sh
npm run cli
```

Run the full benchmark:

```sh
# ... TODO ...
```
