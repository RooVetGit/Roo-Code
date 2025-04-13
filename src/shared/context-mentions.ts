/*
Mention regex:
- **Purpose**: 
  - To identify and highlight specific mentions in text that start with '@'. 
  - These mentions can be file paths, URLs, or the exact word 'problems'.
  - Ensures that trailing punctuation marks (like commas, periods, etc.) are not included in the match, allowing punctuation to follow the mention without being part of it.

- **Regex Breakdown**:
  - `/@`: 
	- **@**: The mention must start with the '@' symbol.
  
  - `((?:\/|\w+:\/\/)(?:\\\\ |[^\s])+?|[a-f0-9]{7,40}\b|problems\b|git-changes\b|terminal\b)`:
	- **Capturing Group (`(...)`)**: Captures the part of the string that matches one of the specified patterns.
	- `(?:\/|\w+:\/\/)`: 
	  - **Non-Capturing Group (`(?:...)`)**: Groups the alternatives without capturing them for back-referencing.
	  - `\/`: 
		- **Slash (`/`)**: Indicates that the mention is a file or folder path starting with a '/'.
	  - `|`: Logical OR.
	  - `\w+:\/\/`: 
		- **Protocol (`\w+://`)**: Matches URLs that start with a word character sequence followed by '://', such as 'http://', 'https://', 'ftp://', etc.
	- `(?:\\\\ |[^\s])+?`: 
	  - **Non-Whitespace Characters (`[^\s]+`)**: Matches one or more characters that are not whitespace.
	  - **Non-Greedy (`+?`)**: Ensures the smallest possible match, preventing the inclusion of trailing punctuation.
	- `|`: Logical OR.
	- `[a-f0-9]{7,40}\b`: 
	  - **Hexadecimal Characters (`[a-f0-9]{7,40}`)**: Matches a hexadecimal string of 7 to 40 characters.
	  - **Word Boundary (`\b`)**: Ensures that the hexadecimal string is matched as a whole word and not as part of another word (e.g., 'problems').
		- `|`: Logical OR.
    - `git-changes\b`:
      - **Exact Word ('git-changes')**: Matches the exact word 'git-changes'.
      - **Word Boundary (`\b`)**: Ensures that 'git-changes' is matched as a whole word and not as part of another word (e.g., 'gitchanges').
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
	- Mentions that are file or folder paths starting with '/' and containing any non-whitespace characters (including periods within the path).
	- URLs that start with a protocol (like 'http://') followed by any non-whitespace characters (including query parameters).
	- The exact word 'problems'.
	- The exact word 'git-changes'.
    - The exact word 'terminal'.
  - It ensures that any trailing punctuation marks (such as ',', '.', '!', etc.) are not included in the matched mention, allowing the punctuation to follow the mention naturally in the text.

- **Global Regex**:
  - `mentionRegexGlobal`: Creates a global version of the `mentionRegex` to find all matches within a given string.

*/

/**
 * Regular expression to match @mentions in text.
 *
 * Key components:
 * - `/@(...)(?=[.,;:!?]?(?:\s|$))`: Matches @-prefixed entities followed by optional punctuation and whitespace/end
 *
 * Inside the first capture group:
 * - `(?:[\/]|\w+:\/\/)`: Matches either a slash (file path) or protocol prefix (URLs)
 * - `(?:\\\\ |.)+`: IMPORTANT - This is a GREEDY match for either:
 *    - Escaped spaces `\\ ` (backslash followed by space)
 *    - ANY character (`.`)
 *   The greedy behavior ensures complete path capture, including multiple spaces
 *   This fixes Windows path handling where paths were previously truncated at spaces
 * - `(?:[a-f0-9]{7,40}|problems|git-changes|terminal)\b`: Matches various non-path entities
 *   (Git commit hashes, special keywords)
 *
 * End lookahead ensures mentions terminate properly and don't include trailing punctuation
 */
export const mentionRegex =
	/@((?:[\/]|\w+:\/\/)(?:\\\\ |.)+|(?:[a-f0-9]{7,40}|problems|git-changes|terminal)\b)(?=[.,;:!?]?(?:\s|$))/
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
