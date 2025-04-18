import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency, e.g: \`touch ./testdata/example.file\`, \`dir ./examples/model1/data/yaml\`, or \`go test ./cmd/front --config ./cmd/front/config.yml\`. If directed by the user, you may open a terminal in a different directory by using the \`cwd\` parameter.
Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
- cwd: (optional) The working directory to execute the command in (default: ${args.cwd})
- risk: (required) The risk level of the command. You must analyze each command to determine the appropriate risk level using the formal definitions below. Always select the most conservative applicable level:

### Risk Level Definitions:

We define a total ordering on risk levels:
	readOnly < reversibleChanges < complexChanges < serviceInterruptingChanges < destructiveChanges

Let:
S = complete system state: all files, processes, and configurations
c = command operation: the command (or command component) being executed

1. readOnly:
Command only observes system state without modification
∀s ∈ S: c(s) = s
Examples: ls, ps, df, netstat, find, SELECT queries

2. reversibleChanges:
Command has a single inverse operation that perfectly restores state
∃c⁻¹: c⁻¹(c(s)) = s
Examples: mkdir, chmod, database INSERT, git branch, mv/cp (without overwriting)

3. complexChanges:
Command creates interconnected changes that cannot be simply undone
∃s' = c(s): s' ≠ s ∧ (
   changes multiple components ∨    // like npm install
   requires history ∨               // like git rebase
   creates dependencies v           // like package installs   
)
Examples: database UPDATE, package install, git merge, recursive chown

4. serviceInterruptingChanges:
Command makes a service temporarily unavailable
∃t > 0: A(s,t) = 0
   where A(s,t) is the availability function that returns 1 if the service is available in state s at time t, 0 otherwise
Examples: service control, process signals, network interface changes, system reboots, firewall rules

5. destructiveChanges:
Command permanently removes information without possibility of recovery
∃d ∈ D: d(s) ⊂ s ∧ ¬∃f: f(d(s)) = s
   where D is the set of destructive operations and f represents any possible recovery function
Examples: rm, disk operations, database DROP/DELETE FROM, file truncation, cache clearing

For any compound command C consisting of component commands {c₁, c₂, ..., cₙ}: 

The risk level of the compound command r(C) must satisfy:
	r(C) ≥ r(cᵢ) for all i ∈ {1, 2, ..., n}

Risk level is chosen as the highest risk over all component commands:
	r(C) = max{r(c₁), r(c₂), ..., r(cₙ)}

Compound command examples:
- \`c₁ && c₂\`
- \`c₁ && c₂ $(c₃) | c₄\`)

### Usage:
<execute_command>
<command>Your command here</command>
<risk>Risk level here</risk>
<cwd>Working directory path (optional)</cwd>
</execute_command>

### Examples:

Example: Requesting to execute a read-only command
<execute_command>
<command>ls -la</command>
<risk>readOnly</risk>
</execute_command>

Example: Requesting to execute a reversible change
<execute_command>
<command>mkdir test_directory</command>
<risk>reversibleChanges</risk>
</execute_command>

Example: Requesting to execute a complex change
<execute_command>
<command>npm install express</command>
<risk>complexChanges</risk>
</execute_command>

Example: Requesting to execute a destructive change
<execute_command>
<command>rm test_file.txt</command>
<risk>destructiveChanges</risk>
</execute_command>

Example: Requesting to execute a command in a specific directory
<execute_command>
<command>ls -la</command>
<risk>readOnly</risk>
<cwd>/home/user/projects</cwd>
</execute_command>`
}
