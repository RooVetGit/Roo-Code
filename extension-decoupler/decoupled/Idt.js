
var idt =
	"- The user is working from the directory `${relPath}`.\n- When the user mentions a file name or when viewing output from shell commands, it is likely relative to `${relPath}`.\n- When creating, deleting, viewing or editing files, first try prepending `${relPath}` to the path.\n- When running shell commands, do not prepend `${relPath}` to the path.\n"