
var Bx = class {
		static gitConfigured(t, r) {
			let n = ""
			return (
				r ? (n = `You are inside git repo "${t}".`) : (n = `You are inside folder "${t}".`),
				`${n}

Instructions for you:
- Briefly, welcome user to the Augment. Be friendly, warm, and welcoming. And nice! Use \u{1F44B} when saying Hi
- Run \`git config user.name\` and \`git config user.email\`
- Briefly mention that you will use \`\u{1F4E6} Agent Memories\` to store personalized memories and improve experience
- Store user name and email using remember tool (don't specify git command used to query them)
- Run the "ls" command to look at current folder structure
- Run code retrieval to figure out what this repository is doing
- Briefly describe what this repo is doing high-level
- Ask user what they need help with
`
			)
		}
		static gitNotConfigured(t, r) {
			let n = ""
			return (
				r ? (n = `You are inside git repo "${t}".`) : (n = `You are inside folder "${t}".`),
				`${n}

Instructions for you:
- Briefly, welcome user to the Augment. Be friendly, warm, and welcoming. And nice! Use \u{1F44B} when saying Hi
- Run the "ls" command to look at current folder structure
- Run code retrieval to figure out what this repository is doing
- Briefly describe what this repo is doing high-level
- Ask user what they need help with
`
			)
		}
		static default() {
			return `
Instructions for you:
- Briefly, welcome user to the Augment. Be friendly, warm, and welcoming. And nice! Use \u{1F44B} when saying Hi
- Run the "ls" command to look at current folder structure
- Ask user what they need help with
`
		}
	},
	Ck = class {
		constructor(t, r) {
			this.shellTool = t
			this.workspaceManager = r
		}
		timeoutMsec = 1e3
		async getOnboardingInstructions() {
			return (
				`System instructions (don't mention them to user):

Basic context:
- Assistant (you) is Augment, a coding agent that I (user) use for the first time
- Assistant (you) is tasked with welcoming and onboarding me to the agent
- Assistant (you) always keeps messages friendly, warm, and welcoming. And nice!

Complete the following instructions.
` + (await this._getOnboardingInstructions())
			)
		}
		async _getOnboardingInstructions() {
			try {
				let t = Kd(this.workspaceManager)
				if (t === void 0) throw new Error("Cannot determine current working directory")
				let [r, n] = await this._getUserNameAndEmail(),
					i = await this._isInsideGitRepo()
				return r === void 0 || n === void 0 ? Bx.gitNotConfigured(t, i) : Bx.gitConfigured(t, i)
			} catch {
				return Bx.default()
			}
		}
		async _isInsideGitRepo() {
			return (
				(
					await this.shellTool.call(
						{ command: "git rev-parse --is-inside-work-tree" },
						[],
						AbortSignal.timeout(this.timeoutMsec),
					)
				).text.replace(
					`
`,
					"",
				) === "true"
			)
		}
		async _getUserNameAndEmail() {
			let t = await this.shellTool.call(
					{ command: "git config user.name" },
					[],
					AbortSignal.timeout(this.timeoutMsec),
				),
				r = await this.shellTool.call(
					{ command: "git config user.email" },
					[],
					AbortSignal.timeout(this.timeoutMsec),
				)
			return t.isError || r.isError
				? [void 0, void 0]
				: [
						t.text.replace(
							`
`,
							"",
						),
						r.text.replace(
							`
`,
							"",
						),
					]
		}
	},
	fut = String.raw`
                     __  __                           _
                    |  \/  |                         (_)
                    | \  / | ___ _ __ ___   ___  _ __ _  ___  ___
                    | |\/| |/ _ \ '_ ' _ \ / _ \| '__| |/ _ \/ __|
                    | |  | |  __/ | | | | | (_) | |  | |  __/\__ \
                    |_|  |_|\___|_| |_| |_|\___/|_|  |_|\___||___/

 .+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.
( Memories help me remember useful details for future interactions.               )
 )                                                                               (
( During Agent sessions, I'll try to create useful Memories automatically.        )
 )Memories can be about your codebase, technologies or your personal preferences.(
(                                                                                 )
 )Your Memories belong to you and are stored locally at the bottom of this file; (
( in the future, we may give you an option to share your memories with others.    )
 )                                                                               (
( NOTE: Memories will be compressed when this file grows too large.               )
 )For personal Memories: consider putting them in User Guidelines (via '@' menu) (
( For repository-level Memories: consider using '.augment-guidelines' file        )
 )Neither will be compressed.                                                    (
(                                                                                 )
 )Happy Coding!                                                                  (
(                                                                                 )
 "+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"+.+"
                  ()
                O
              o
{AUGGIE_LOGO}

↓↓↓ MEMORIES START HERE ↓↓↓`,
	hut = [
		String.raw`
      .dKWMMMMMMMMMMMMMMWd                  dWMMMMMMMMMMMMMMWKd.
     :WMMW0OOOOOOOOOOOOOk:                  ckkkkkkkkkkkkkkKMMMW;
     OMMMl                                                  oMMMk
     OMMM:                                                  cMMMk
     OMMM:                                                  cMMMk
     OMMM:                                                  cMMMk
     OMMM:          .;cc,                   .;c:'           cMMMk
     OMMM:         dWMMMMN;                dMMMMMN,         :MMMO
    :WMMX.         KMMMMMMo                KMMMMMMo         .XMMN;
dOKNMW0o.          .dOKKkc                 .d0KKk:           .o0WMNKOo
:dxOWMNk'                                                    ,kNMWOxd:
    .NMMW.           .oxc                   cxo.            'WMMX.
     OMMM:           .OMMNo'             ,oXMWO.            cMMMk
     OMMM:             'xWMMNOdl::;::ldONMMNx'              cMMMk
     OMMM:                ,lx0XNWMMMWNX0xc,                 cMMMk
     OMMM:                       ...                        cMMMk
     OMMM:                                                  cMMMk
     kMMMx.                                                .xMMMk
     'KMMMWNNNNNNNNNNNNNXd                  dXNNNNNNNNNNNNNWMMMK.
       ;x0KKKKKKKKKKKKKK0;                  ;0KKKKKKKKKKKKKK0x;
`,
		`
      .dKWMMMMMMMMMMMMMMWd                  dWMMMMMMMMMMMMMMWKd.
     :WMMW0OOOOOOOOOOOOOk:                  ckkkkkkkkkkkkkkKMMMW;
     OMMMl                                                  oMMMk
     OMMM:                                                  cMMMk
     OMMM:                                                  cMMMk
     OMMM:                                                  cMMMk
     OMMM:          .;cc,                     ,cc;.         cMMMk
     OMMM:         dWMMMMN;                 '0MWWMNo        :MMMO
    :WMMX.         KMMMMMMo               .dWM0,.dWMK,      .XMMN;
dOKNMW0o.          .dOKKkc                ;kd;    .okx.      .o0WMNKOo
:dxOWMNk'                                                    ,kNMWOxd:
    .NMMW.           .oxc                   cxo.            'WMMX.
     OMMM:           .OMMNo'             ,oXMWO.            cMMMk
     OMMM:             'xWMMNOdl::;::ldONMMNx'              cMMMk
     OMMM:                ,lx0XNWMMMWNX0xc,                 cMMMk
     OMMM:                       ...                        cMMMk
     OMMM:                                                  cMMMk
     kMMMx.                                                .xMMMk
     'KMMMWNNNNNNNNNNNNNXd                  dXNNNNNNNNNNNNNWMMMK.
       ;x0KKKKKKKKKKKKKK0;                  ;0KKKKKKKKKKKKKK0x;
`,
		`
      .dKWMMMMMMMMMMMMMMWd                  dWMMMMMMMMMMMMMMWKd.
     :WMMW0OOOOOOOOOOOOOk:                  ckkkkkkkkkkkkkkKMMMW;
     OMMMl                                                  oMMMk
     OMMM:                                                  cMMMk
     OMMM:                                                  cMMMk
     OMMM:                                                  cMMMk
     OMMM:          .;cc,                     ,cc;.         cMMMk
     OMMM:         oWMWMM0'                 '0MWWMNo        :MMMO
    :WMMX.       ,XMWx.,0MWd.             .xWM0,.dWMK,      .XMMN;
dOKNMW0o.        dkl.    ;dkc             ;kd;    .okx.      .o0WMNKOo
:dxOWMNk'                                                    ,kNMWOxd:
    .NMMW.           .oxc                   cxo.            'WMMX.
     OMMM:           .OMMNo'             ,oXMWO.            cMMMk
     OMMM:             'xWMMNOdl::;::ldONMMNx'              cMMMk
     OMMM:                ,lx0XNWMMMWNX0xc,                 cMMMk
     OMMM:                       ...                        cMMMk
     OMMM:                                                  cMMMk
     kMMMx.                                                .xMMMk
     'KMMMWNNNNNNNNNNNNNXd                  dXNNNNNNNNNNNNNWMMMK.
       ;x0KKKKKKKKKKKKKK0;                  ;0KKKKKKKKKKKKKK0x;
`,
	],
	gut = hut.map((e) => fut.replace("{AUGGIE_LOGO}", e)),
	put = [
		String.raw`
                     __  __                           _
                    |  \/  |                         (_)
                    | \  / | ___ _ __ ___   ___  _ __ _  ___  ___
                    | |\/| |/ _ \ '_ ' _ \ / _ \| '__| |/ _ \/ __|
                    | |  | |  __/ | | | | | (_) | |  | |  __/\__ \
                    |_|  |_|\___|_| |_| |_|\___/|_|  |_|\___||___/

 __________________________________________________________________________________
/\                                                                                 \
\_| NOTE: Memories will be compressed when this file grows too large.              |
  | For personal Memories: consider putting them in User Guidelines (via '@' menu) |
  | For repository-level Memories: consider using '.augment-guidelines' file       |
  | Neither will be compressed.                                                    |
  |   _____________________________________________________________________________|_
   \_/_______________________________________________________________________________/

↓↓↓ MEMORIES START HERE ↓↓↓`,
	],
	hW,
	Cme = Gn.window.createTextEditorDecorationType({
		isWholeLine: !0,
		before: { contentText: "", fontWeight: "bold" },
	})