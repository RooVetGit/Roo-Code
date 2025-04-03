
function Pa(e) {
	return e.containingFolderRoot !== void 0
		? "nested"
		: e.isHomeDir
			? "home directory"
			: e.folderQualification !== void 0 && !e.folderQualification.trackable
				? "too large"
				: e.syncingPermission === "denied"
					? "permission denied"
					: e.syncingPermission === "granted"
						? "trackable"
						: e.folderQualification === void 0
							? "qualifying"
							: "permission needed"
}