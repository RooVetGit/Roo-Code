---
"roo-cline": patch
---

Added a basic CLI capability which interfaces the extension via a websocket server started by the extension on startup. Have utilized the methods exposed in `src/exports/api.ts` to interface with the sidebar instance of Roo Code. There is a new directory in the root called `roocli` which houses the websocket client and the CLI logic. The websocket server has been put in a new directory inside `src/services/extend`.
