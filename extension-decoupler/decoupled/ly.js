
var gM = class extends Error {
		constructor() {
			super("source folder enumeration is not complete")
		}
	},
	Ly = ((s) => (
		(s[(s.vscodeWorkspaceFolder = 0)] = "vscodeWorkspaceFolder"),
		(s[(s.externalFolder = 1)] = "externalFolder"),
		(s[(s.nestedWorkspaceFolder = 2)] = "nestedWorkspaceFolder"),
		(s[(s.nestedExternalFolder = 3)] = "nestedExternalFolder"),
		(s[(s.untrackedFolder = 4)] = "untrackedFolder"),
		s
	))(Ly || {})