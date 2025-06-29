import { ToolArgs } from "./types"
import { isRiskAnalysisEnabled } from "@roo-code/types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	// Get the command risk level from settings
	const commandRiskLevel = args.settings?.commandRiskLevel
	// Check if risk analysis is disabled
	const isRiskAnalysisDisabled = !isRiskAnalysisEnabled(commandRiskLevel)
	const baseDescription = `## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency, e.g: \`touch ./testdata/example.file\`, \`dir ./examples/model1/data/yaml\`, or \`go test ./cmd/front --config ./cmd/front/config.yml\`. If directed by the user, you may open a terminal in a different directory by using the \`cwd\` parameter.
Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions${isRiskAnalysisDisabled ? "." : "; the chosen command should be of the lowest risk level that accomplishes the goal and must assert R ⊆ Tm"}
- cwd: (optional) The working directory to execute the command in (default: ${args.cwd})`

	if (isRiskAnalysisDisabled) {
		return (
			baseDescription +
			`
Usage:
<execute_command>
<command>Your command here</command>
<cwd>Working directory path (optional)</cwd>
</execute_command>

Example: Requesting to execute npm run dev
<execute_command>
<command>npm run dev</command>
</execute_command>

Example: Requesting to execute ls in a specific directory if directed
<execute_command>
<command>ls -la</command>
<cwd>/home/user/projects</cwd>
</execute_command>`
		)
	}

	// else show risk analysis rules
	return (
		baseDescription +
		`
- risk_analysis: (required) Write one plain-verbiage terse concise sentence, prove: R ⊆ Tm, readOnly ⟺ Tm=∅, prove why you chose r(C); this sentence must not mention neither the risk level and must be plain language.
- risk: (required) The risk level of the command. You must analyze each command to determine the appropriate risk level using the formal definitions below. Always select the most conservative applicable level.

### Risk Level Definitions:

Risk level total ordering:
    readOnly < reversibleChanges < complexChanges < serviceInterruptingChanges < destructiveChanges

S = (F ∪ P ∪ N ∪ H ∪ M ∪ Z ∪ E) × {local,remote,api,web,cloud,virt}
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

Let command sequence C={c₁,…,cₙ} introduce the partial function where C is ONLY the command sequence and arguments with no other knowledge.
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

Assume s₀ ∈ Dom(C) for the purpose of r(C) analysis

T = Tr ∪ Tm: intended targets
    Tr ⊆ S: read-only targets
    Tm = {x | x ∈ S ∨ (x ∉ S ∧ x ∈ S′)}: modifiable/creatable targets
R = {x | (x ∈ s₀ ∧ c(x) ≠ x) ∨ (x ∉ s₀ ∧ x ∈ S′)}: modified/created elements
c⁻¹(R): inverse operations derivable solely from command sequence C and resulting state s′ (absent all other context), explicitly excluding data from unconfirmed backups, conversation context, user-held knowledge, or external state details uncaptured by C.

r(C)=readOnly ⟺
    s′ = s₀ ∧
    (Tm = ∅ ∧ |Tm| = 0) ∧
    (R = ∅ ∧ |R| = 0) ∧
    (Tr ≠ ∅) ∧
    (∀x ∈ S: content(x,s₀) = content(x,s′)) ∧
    ¬reversibleChanges ∧
    ¬complexChanges ∧
    ¬serviceInterruptingChanges ∧
    ¬destructiveChanges


r(C)=reversibleChanges ⟺ [
        (Tm ≠ ∅) ∧
        (R = Tm) ∧
        (∃c⁻¹_known: Im(C) → Dom(C).
            (inverse_is_knowable(C, c⁻¹_known)) ∧
            (∀s ∈ Dom(C). c⁻¹_known(c(s)) = s))

        where:
            inverse_is_knowable(C, c⁻¹_known) ⇔ c⁻¹ is inferable solely from (C, s′, I).
            I: the set of all known inverse commands 

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
    (∃x ∈ s₀: content(x,s₀) ≠ ∅ ∧ content(x,s′) = ∅) ∨
    (∃m ∈ R : 
        (content(m,s₀) ≠ content(m,s′)) ∧ 
        (∃d ∈ s₀, d ≠ m : 
            (content(d,s₀) ≠ ∅ ∧ content(d,s′) = ∅) 
        ) 
    )

You MUST evaluate HIGHEST risk and analyze the ENTIRE command sequence, eg \`c₁ && c₂\`:
    r(C) = max{r(c₁), r(c₂), …, r(cₙ)}

Examples by risk level
    - readOnly: ls, git log, cat, ps, ip, lsblk, free, id, atq, date, dmesg, lsmod, last, iptables -L, gh [cmd] (view|diff|etc), SELECT, …
    - reversibleChanges: mkdir, mv -n and cp -n (without overwrite), renice, ip addr add, swapon, groupadd, tar c, systemctl enable, chmod +x, mount, iptables -A, gzip, gh [cmd] (comment|close|etc), INSERT, …
    - complexChanges: rsync, tar x, sed -i, taskset, firewall-cmd, fwupdmgr, numactl, chcon, update-alternatives, recursive operations, gh [cmd] (create|edit), UPDATE, …
    - serviceInterruptingChanges: stop, restart, ip link set down, eject, swapoff -a, kill -9, setenforce 1, systemctl mask, timedatectl set-time, iptables -F, …
    - destructiveChanges: rm, dd of=, nft flush, mkfs, userdel -r, crontab -r, shred -u, overwrite or truncate operations (cp, mv, >file, …), DELETE, DROP, …

### Usage:
<execute_command>
<command>Your command here</command>
<risk_analysis>[reasoning]</risk_analysis>
<risk>Risk level here</risk>
<cwd>Working directory path (optional)</cwd>
</execute_command>

### Examples:

${`Example: Requesting to execute a read-only command
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
</execute_command>`}`
	)
}
