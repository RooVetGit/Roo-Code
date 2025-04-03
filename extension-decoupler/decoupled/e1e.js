
var E1e =
	Lv.default.platform === "win32"
		? [
				"APPDATA",
				"HOMEDRIVE",
				"HOMEPATH",
				"LOCALAPPDATA",
				"PATH",
				"PROCESSOR_ARCHITECTURE",
				"SYSTEMDRIVE",
				"SYSTEMROOT",
				"TEMP",
				"USERNAME",
				"USERPROFILE",
			]
		: ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"]