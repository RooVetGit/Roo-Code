# Regex Benchmarks

This directory contains benchmarking scripts for measuring the performance of regular expressions used in the project.

## Mention Regex Benchmark

The `mention-regex-benchmark.ts` script benchmarks the performance of the `mentionRegexGlobal` regex pattern defined in `src/shared/context-mentions.ts`. This pattern is used to identify mentions in text that start with '@', such as file paths, URLs, or specific words like 'problems', 'git-changes', or 'terminal'.

### Running the Benchmark

To run the benchmark:

```bash
# Using the convenience script
./src/benchmarks/run-mention-benchmark.js

# Or directly with tsx
npx tsx src/benchmarks/mention-regex-benchmark.ts
```

### Benchmark Test Cases

The benchmark includes the following test cases:

1. **File Paths**: Tests mentions of file paths starting with '@/'
2. **URLs**: Tests mentions of URLs with various protocols
3. **Special Words**: Tests mentions of special words like 'problems', 'git-changes', 'terminal'
4. **Git Hashes**: Tests mentions of git commit hashes
5. **Mixed Content**: Tests a mix of different mention types
6. **With Punctuation**: Tests mentions followed by punctuation
7. **Large Text**: Tests performance on large text with few mentions (worst case scenario)
8. **Typing Simulation**: Simulates user typing character by character, testing regex performance during interactive typing

### Results

Benchmark results are saved to:

- `src/benchmarks/results/mention-regex-benchmark-[timestamp].md`: A timestamped record of each benchmark run
- `src/benchmarks/results/mention-regex-benchmark-latest.md`: Always contains the most recent benchmark results

The results include:

- The regex pattern being tested
- For each test case:
    - Number of iterations
    - Number of matches found
    - Total execution time in milliseconds
    - Average time per iteration in milliseconds
    - Matches processed per second

### Purpose

This benchmark serves as a reference for future regex changes. When modifying the regex pattern, you can run this benchmark to compare performance before and after the changes to ensure that performance is maintained or improved.
