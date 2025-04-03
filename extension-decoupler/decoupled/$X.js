
var x4 = "augment://sign-in",
	dCe = `Augment is only available to signed in users. [Please sign in](${x4}).`,
	fCe =
		"Augment works best when it has access to your entire codebase. Please grant permission to sync your workspace.",
	$x = class {
		constructor(t, r) {
			this.message = t
			this.response = r
			this.occuredAt = new Date()
		}
		occuredAt
	}