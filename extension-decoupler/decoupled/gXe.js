
var yC = {
		background: new __.ThemeColor("statusBarItem.warningBackground"),
		foreground: new __.ThemeColor("statusBarItem.warningForeground"),
	},
	e8 = {
		background: new __.ThemeColor("statusBarItem.errorBackground"),
		foreground: new __.ThemeColor("statusBarItem.errorForeground"),
	},
	Mxe = { priority: 3, tooltip: "Augment", icon: "$(augment-icon-simple)" },
	Fxe = { priority: 3, tooltip: "Open Augment", icon: "$(augment-icon-smile)" },
	Qxe = {
		priority: 0,
		tooltip: "Sign in to start using Augment",
		icon: "$(augment-icon-simple)",
		colors: yC,
	},
	Nxe = {
		priority: 2,
		tooltip: "Augment is indexing your codebase",
		icon: "$(sync)",
	},
	Pxe = {
		priority: 0,
		tooltip: "No API token",
		icon: "$(augment-icon-simple)",
		colors: yC,
	},
	Lxe = {
		priority: 0,
		tooltip: "No completion URL",
		icon: "$(augment-icon-simple)",
		colors: yC,
	},
	Uxe = {
		priority: 2,
		tooltip: "Initializing Augment",
		icon: "$(loading~spin)",
	},
	Oxe = {
		priority: 0,
		tooltip: "Authentication failed, please sign in again",
		icon: "$(augment-icon-simple)",
		colors: yC,
	},
	qxe = {
		priority: 0,
		tooltip: "Authentication failed, please check your API token and completion URL",
		icon: "$(augment-icon-simple)",
		colors: yC,
	},
	Vxe = {
		priority: 0,
		tooltip: "The completion URL setting is invalid. Please enter a valid value",
		icon: "$(augment-icon-simple)",
		colors: yC,
	},
	Hxe = {
		priority: 2,
		tooltip: "Automatic completions are off",
		icon: "$(augment-icon-closed-eyes)",
	},
	Wxe = {
		priority: 1,
		tooltip: "Enhancements are off",
		icon: "$(augment-icon-simple)",
	},
	t8 = {
		priority: 0,
		tooltip: "Cannot connect to Augment",
		icon: "$(augment-icon-simple)",
		colors: e8,
	},
	Gxe = {
		priority: 0,
		tooltip: "Failed to generate completion",
		icon: "$(augment-icon-simple)",
		colors: e8,
	},
	$xe = {
		priority: 1,
		tooltip: "Generating completion",
		icon: "$(augment-icon-dots)",
	},
	Yxe = {
		priority: 2,
		tooltip: "No completions generated",
		icon: "$(augment-icon-zero)",
	},
	Kxe = {
		priority: 0,
		tooltip: "Failed to generate suggestions",
		icon: "$(augment-icon-simple)",
		colors: e8,
	},
	Jxe = {
		priority: 1,
		tooltip: "Generating suggestions",
		icon: "$(augment-icon-dots)",
	},
	zxe = {
		priority: 2,
		tooltip: "No suggestions generated",
		icon: "$(augment-icon-zero)",
	},
	jxe = {
		priority: 0,
		tooltip: "Workspace indexing is disabled",
		icon: "$(circle-slash)",
	}