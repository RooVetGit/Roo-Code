# Mention Regex Benchmark Results

Benchmark run on: 4/5/2025, 11:52:57 PM

## Regex Pattern

```javascript
;/@((?:\/|\w+:\/\/)[^\s]+?|[a-f0-9]{7,40}\b|problems\b|git-changes\b|terminal\b)(?=[.,;:!?]?(?=[\s\r\n]|$))/g
```

## Results

| Test Case         | Description                                        | Iterations | Matches | Total Time (ms) | Time/Iter (ms) | Matches/sec |
| ----------------- | -------------------------------------------------- | ---------- | ------- | --------------- | -------------- | ----------- |
| file_paths        | File paths starting with @/                        | 100        | 500     | 16.04           | 0.1604         | 3117086     |
| urls              | URLs with protocols                                | 100        | 500     | 15.05           | 0.1505         | 3321634     |
| special_words     | Special words like problems, git-changes, terminal | 100        | 600     | 15.56           | 0.1556         | 3855773     |
| git_hashes        | Git commit hashes                                  | 100        | 400     | 15.09           | 0.1509         | 2651436     |
| mixed             | Mixed content with various mention types           | 100        | 800     | 22.69           | 0.2269         | 3526054     |
| with_punctuation  | Mentions followed by punctuation                   | 100        | 600     | 16.48           | 0.1648         | 3640593     |
| large_text        | Large text with few mentions (worst case scenario) | 100        | 50      | 0.89            | 0.0089         | 5603026     |
| typing_simulation | Simulating user typing character by character      | 100        | 1490    | 345.67          | 3.4567         | 431051      |
