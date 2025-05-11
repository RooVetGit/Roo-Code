import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency, e.g: \`touch ./testdata/example.file\`, \`dir ./examples/model1/data/yaml\`, or \`go test ./cmd/front --config ./cmd/front/config.yml\`. If directed by the user, you may open a terminal in a different directory by using the \`cwd\` parameter.
Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions; the chosen command should be of the lowest risk level that accomplishes the goal and must assert R ⊆ Tm
- cwd: (optional) The working directory to execute the command in (default: ${args.cwd})
- risk_analysis: (required) Write one plain-verbiage terse concise sentence, prove: R ⊆ Tm, readOnly ⟺ Tm=∅, prove why you chose r(C); this sentence must not mention neither the risk level and must be plain lay language.
- risk: (required) The risk level of the command. You must analyze each command to determine the appropriate risk level using the formal definitions below. Always select the most conservative applicable level.

### Risk Level Definitions:

Risk level total ordering:
    readOnly < reversibleChanges < complexChanges < serviceInterruptingChanges < destructiveChanges

S = F ∪ P ∪ N ∪ H ∪ M ∪ Z ∪ E
    F = storage: files, databases, git repos, disks, …
    P = processes, services, VMs, containers, …
    N = network configs, …
    H = hardware, physical controls, …
    M = memory states, locks, resources, …
    Z = security: permissions, keys, tokens, …
    E = temporal state: tasks, cron, timers, …

s₀ ∈ S:          initial state before C
s′ ∈ S′:         final state after C
atoms(x):        minimal addressable units
content(x,s):    accessible atoms in s
a ∉ content(x,s) if deleted, truncated, overwritten, corrupted, encrypted with lost key

Let command sequence C={c₁,…,cₙ} introduce the partial function  
   c: S ⇀ S′  
by the operational judgments  
   ⟨C,s⟩⇓s′ iff C, started in s, terminates normally in s′  
   ⟨C,s⟩⇑   iff C, started in s, aborts with an error.  

Then  
   c(s)=s′ ↔ ⟨C,s⟩⇓s′  
   c(s)↑   ↔ ⟨C,s⟩⇑  

Finally  
   Dom(C) ≔ dom(c)  
   Im(C)  ≔ ran(c) = c[Dom(C)]

T = Tr ∪ Tm: intended targets
    Tr ⊆ S: read-only targets
    Tm = {x | x ∈ S ∨ (x ∉ S ∧ x ∈ S′)}: modifiable/creatable targets
R = {x | (x ∈ s₀ ∧ c(x) ≠ x) ∨ (x ∉ s₀ ∧ x ∈ S′)}: modified/created elements
c⁻¹(R): inverse operations known to be possible with only knowledge of S′ (eg, when all other context knowledge is lost); inverse operations exclude, without limitation:
    - data restored from unconfirmed sources like hypothetical backups
    - knowledge within this conversation context
    - knowledge assumed to be within the user's mind

r(C)=readOnly ⟺
    ¬reversibleChanges ∧
    ¬complexChanges ∧
    ¬serviceInterruptingChanges ∧
    ¬destructiveChanges ∧
    (Tm = ∅ ∧ |Tm| = 0) ∧
    (R = ∅ ∧ |R| = 0) ∧
    (Tr ≠ ∅ ∨ Tr = ∅) ∧
    S′ = S ∧
    Dom(C) = ∅ ∧
    (∀x ∈ S: content(x,s₀) = content(x,s′))

r(C)=reversibleChanges ⟺ [
        (Tm ≠ ∅) ∧
        (R = Tm) ∧
        (∃c⁻¹: Im(C) → Dom(C).
            ∀s ∈ Dom(C).
                c⁻¹( c(s) ) = s)
    ] ⟺ [
        ∀ s₁, s₂ ∈ Dom(C).  
                (c(s₁) = c(s₂) → s₁ = s₂)
    ]

r(C)=complexChanges ⟺
    ¬readOnly ∧
    ¬reversibleChanges ∧
    ¬serviceInterruptingChanges ∧
    ¬destructiveChanges

r(C)=serviceInterruptingChanges ⟺
    ∃p ∈ Tm ∩ P, ∃t₁ ∈ ℝ⁺:
        A(p,0) ∧
        ¬A(p,t₁) ∧
        ((∃t₂ > t₁: A(p,t₂)) ∨ p ∉ s′)
    where A(x,t): availability at time t

r(C)=destructiveChanges ⟺
    (R ⊈ Tm) ∨
    (∃x ∈ s₀: content(x,s₀) ≠ ∅ ∧ content(x,s′) = ∅)

For compound commands:
    r(C) = max{r(c₁), r(c₂), …, r(cₙ)}

### Usage:
<execute_command>
<command>Your command here</command>
<risk_analysis>[reasoning]</risk_analysis>
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
