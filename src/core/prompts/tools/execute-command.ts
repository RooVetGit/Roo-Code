import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency, e.g: \`touch ./testdata/example.file\`, \`dir ./examples/model1/data/yaml\`, or \`go test ./cmd/front --config ./cmd/front/config.yml\`. If directed by the user, you may open a terminal in a different directory by using the \`cwd\` parameter.
Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions; the chosen command should be of the lowest risk level that accomplishes the goal and must assert R ⊆ Tm
- cwd: (optional) The working directory to execute the command in (default: ${args.cwd})
- risk_analysis: (required) Write one plain-verbiage terse concise sentence without mention of predicate logic, analyzing: why R ⊆ Tm=true and R ⊃ Tm=false in terms of s₀, why you chose r(C), any possible c⁻¹(R); this sentence must not mention any risk level itself.
- risk: (required) The risk level of the command. You must analyze each command to determine the appropriate risk level using the formal definitions below. Always select the most conservative applicable level.

### Risk Level Definitions:

We define a total ordering on risk levels:
	readOnly < reversibleChanges < complexChanges < serviceInterruptingChanges < destructiveChanges

Let:
S = F ∪ P ∪ N where:
   F = set of all files
   P = set of running processes
   N = network configuration
s₀ ∈ S: initial states of targets prior to c₁ command execution
s′ ∈ S′: final states S′ after command execution

atoms(x): set of minimal addressable units for target x
   - files: bytes, lines, …
   - disks: sectors, blocks, …
   - databases: rows, keys, …
   - network configs: interfaces, rules, routes, ACLs, …
   - processes: threads, resources, …

content(x, s): set of accessible atoms of target x in state s.  ∀a ∈ atoms(x), a ∉ content(x, s) if any of the following, without limitation, are true:
   - content(x, s) = ∅
   - a was deleted from x
   - a lies beyond the truncation point
   - a was overwritten or zeroed
   - a is structurally corrupted
   - a is encrypted with lost key

cᵢ ∈ C: complete command consisting of a sequence of one or more subcommands {c₁, c₂, …, cₙ} executed in order,  where n is the number of commands in C

T = Tr ∪ Tm where:
   Tr ⊆ S = targets that commands in C read but do not modify
   Tm = {x | x ∈ S ∨ (x ∉ S ∧ x ∈ S′)} = targets in initial state or to be created in final state

R = {x | (x ∈ s₀ ∧ c(x) ≠ x) ∨ (x ∉ s₀ ∧ x exists after C)} = elements modified or created between s₀ and completion of C including any inadvertent modification or creation that must be prevented by C

c(T) = command being executed
   - assume no backups are available
   - choose C to prevent R ⊈ Tm (no side effects outside modified or created targets)
   - assert R ⊆ Tm (changes limited to modifiable or creatable targets)
c⁻¹(R) = only commands that may invert R; inverse operations must be commands

1. r(C)=readOnly: Command only reads targets, makes no modifications
   Tm = ∅ ∧ R = ∅ ∧ (Tr ≠ ∅ ∨ Tr = ∅)
Examples: ls, ps, df, netstat, find, SELECT queries

2. r(C)=reversibleChanges: Command modifications can be undone by a single command
   Tm ≠ ∅ ∧ ∀s₀ ∈ S: ∃c⁻¹: (c⁻¹(c(s₀)) = s₀) ∧ (|c⁻¹| = 1) ∧ R = Tm   # must restore exactly to initial state
Examples: mkdir, chmod, database INSERT, git branch, mv/cp (without overwriting)

3. r(C)=complexChanges: Command makes partial irreversible modifications while preserving some content
   ¬destructiveChanges                   # destructiveChanges takes precedence if applicable
   ∧ Tm ≠ ∅ ∧ ∃s′ = c(s₀):
      (R ⊆ Tm)                           # changes limited to modifiable targets
      ∧ (∀x ∈ R:                         # for all modified elements
         (∃p ⊂ atoms(x):                 # some atoms of original content
            p ∈ content(x,s′))           # remain unchanged and accessible
         ∧ (∃q ⊂ atoms(x):               # and some atoms
            q ∉ content(x,s′)            # are irreversibly modified/lost
            ∧ ¬∃c⁻¹: c⁻¹(c(q)) = q))     # cannot be restored by any inverse command
Examples: database UPDATE, package install, git merge, recursive chown, \`sed -i 's/old/new/' file\`

4. r(C)=serviceInterruptingChanges: Command affects service availability
   Let:
   - t ∈ ℝ⁺ represent time in seconds since command start
   - A(x,t) be the availability function that returns true if x is available at time t, false if not
   ∃p ∈ Tm ∩ P: ∃t₁ ∈ ℝ⁺:
      A(p,0)                        # service starts available
      ∧ ¬A(p,t₁)                    # service becomes unavailable
      ∧ ((∃t₂ > t₁: A(p,t₂))        # service recovers (temporary interruption)
         ∨ p ∉ s′)                  # or service removed (permanent)
Examples: service stop/start, process signals that cause interruption, network interface changes, system reboots

5. r(C)=destructiveChanges: Command completely obliterates all targeted data
   Let s₀ be initial state, s′ = c(s₀) be final state:
      (∃x ∈ s₀: x ∉ s′)                  # elements completely removed from initial state
      ∨ (R ⊈ Tm)                         # any change outside modifiable/creatable targets
      ∨ (∃x ∈ s₀:                        # target existed in initial state
         content(x,s₀) ≠ ∅               # had content initially
         ∧ (∀a ∈ atoms(x):               # for all atoms,
             a ∉ content(x,s′)))         # every atom is lost/inaccessible
   Note: Applies only when the entire target content is lost/removed/unrecoverable
Examples: rm, disk commands, database DROP/DELETE FROM, file truncation, cache clearing

For any compound command C consisting of component commands {c₁, c₂, …, cₙ}:

The risk level of the compound command r(C) must satisfy:
  - ∀s ∈ S, ∀c ∈ C: r(c) ≤ r(C), and
  - r(C) = max { r(c) | c ∈ C }

Risk level is chosen as the highest risk over all component commands:
	r(C) = max{r(c₁), r(c₂), …, r(cₙ)}

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
<risk_analysis>[reasoning]</risk_analysis>
<risk>readOnly</risk>
</execute_command>

Example: Requesting to execute a reversible change
<execute_command>
<command>mkdir test_directory</command>
<risk_analysis>[reasoning]</risk_analysis>
<risk>reversibleChanges</risk>
</execute_command>

Example: Requesting to execute a complex change
<execute_command>
<command>npm install express</command>
<risk_analysis>[reasoning]</risk_analysis>
<risk>complexChanges</risk>
</execute_command>

Example: Requesting to execute a destructive change
<execute_command>
<command>rm test_file.txt</command>
<risk_analysis>[reasoning]</risk_analysis>
<risk>destructiveChanges</risk>
</execute_command>

Example: Requesting to execute a command in a specific directory
<execute_command>
<command>ls -la</command>
<risk_analysis>[reasoning]</risk_analysis>
<risk>readOnly</risk>
<cwd>/home/user/projects</cwd>
</execute_command>`
}
