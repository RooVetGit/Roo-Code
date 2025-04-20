/*
Mention regex:
- **Purpose**:
  - To identify and highlight specific mentions in text that start with '@'.
  - These mentions can be file paths, URLs, or the exact word 'problems'.
  - Ensures that trailing punctuation marks (like commas, periods, etc.) are not included in the match, allowing punctuation to follow the mention without being part of it.

- **Regex Breakdown**:
  - `/@`:
	- **@**: The mention must start with the '@' symbol.

  - `((?:\/|\w+:\/\/)[^\r\n]*?(?=\s*$|\s+@|[.,;:!?](?=[\s\r\n]|$))|problems\b|git-changes\b)`:
	- **Capturing Group (`(...)`)**: Captures the part of the string that matches one of the specified patterns.
	- `(?:\/|\w+:\/\/)`:
	  - **Non-Capturing Group (`(?:...)`)**: Groups the alternatives without capturing them for back-referencing.
	  - `\/`:
		- **Slash (`/`)**: Indicates that the mention is a file or folder path starting with a '/'.
	  - `|`: Logical OR.
	  - `\w+:\/\/`:
		- **Protocol (`\w+://`)**: Matches URLs that start with a word character sequence followed by '://', such as 'http://', 'https://', 'ftp://', etc.
	- `[^\s\r\n]*?(?:\\[\s][^\s\r\n]*?)*?(?=\s*$|\s+@|[.,;:!?](?=[\s\r\n]|$))`:
	  - **Character Pattern**: Matches any characters except whitespace and line breaks.
	  - **Escaped Spaces**: The `(?:\\[\s][^\s\r\n]*?)*?` part allows for escaped spaces (like `\s`) in the path.
	  - **Followed by a lookahead**: Ensures the match ends at the end of the line, before another @ symbol, or before punctuation followed by whitespace or end of line.
	  - **This handles paths with escaped spaces (e.g., `my\ folder/my\ file.txt`)**.
	  - **Non-Greedy (`*?`)**: Ensures the smallest possible match.
	- `|`: Logical OR.
	- `problems\b`:
	  - **Exact Word ('problems')**: Matches the exact word 'problems'.
	  - **Word Boundary (`\b`)**: Ensures that 'problems' is matched as a whole word and not as part of another word (e.g., 'problematic').
		- `|`: Logical OR.
    - `terminal\b`:
      - **Exact Word ('terminal')**: Matches the exact word 'terminal'.
      - **Word Boundary (`\b`)**: Ensures that 'terminal' is matched as a whole word and not as part of another word (e.g., 'terminals').
  - `(?=[.,;:!?]?(?=[\s\r\n]|$))`:
	- **Positive Lookahead (`(?=...)`)**: Ensures that the match is followed by specific patterns without including them in the match.
	- `[.,;:!?]?`:
	  - **Optional Punctuation (`[.,;:!?]?`)**: Matches zero or one of the specified punctuation marks.
	- `(?=[\s\r\n]|$)`:
	  - **Nested Positive Lookahead (`(?=[\s\r\n]|$)`)**: Ensures that the punctuation (if present) is followed by a whitespace character, a line break, or the end of the string.

- **Summary**:
  - The regex effectively matches:
	- Mentions that are file or folder paths starting with '/' and can contain escaped spaces within the path (e.g., 'my\ folder/my\ file.txt').
	  The regex properly handles paths with escaped spaces and ensures the entire path is captured.
	- URLs that start with a protocol (like 'http://') followed by any non-whitespace characters (including query parameters).
	- The exact word 'problems'.
	- The exact word 'git-changes'.
    - The exact word 'terminal'.
  - It ensures that any trailing punctuation marks (such as ',', '.', '!', etc.) are not included in the matched mention, allowing the punctuation to follow the mention naturally in the text.

- **Global Regex**:
  - `mentionRegexGlobal`: Creates a global version of the `mentionRegex` to find all matches within a given string.

*/
export const mentionRegex =
	/@((?:\/|\w+:\/\/)[^\s\r\n]*?(?:\\[\s][^\s\r\n]*?)*?(?=\s*$|\s+@|[.,;:!?](?=[\s\r\n]|$))|[a-f0-9]{7,40}\b|problems\b|git-changes\b|terminal\b)(?=[.,;:!?]?(?=[\s\r\n]|$))/
export const mentionRegexGlobal = new RegExp(mentionRegex.source, "g")

export interface MentionSuggestion {
	type: "file" | "folder" | "git" | "problems"
	label: string
	description?: string
	value: string
	icon?: string
}

export interface GitMentionSuggestion extends MentionSuggestion {
	type: "git"
	hash: string
	shortHash: string
	subject: string
	author: string
	date: string
}

export function formatGitSuggestion(commit: {
	hash: string
	shortHash: string
	subject: string
	author: string
	date: string
}): GitMentionSuggestion {
	return {
		type: "git",
		label: commit.subject,
		description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
		value: commit.hash,
		icon: "$(git-commit)", // VSCode git commit icon
		hash: commit.hash,
		shortHash: commit.shortHash,
		subject: commit.subject,
		author: commit.author,
		date: commit.date,
	}
}
