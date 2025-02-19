import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { memo } from "react"
import { Trans, useTranslation } from "react-i18next"
// import VSCodeButtonLink from "./VSCodeButtonLink"
// import { getOpenRouterAuthUrl } from "./ApiOptions"
// import { vscode } from "../utils/vscode"

interface AnnouncementProps {
	version: string
	hideAnnouncement: () => void
}
/*
You must update the latestAnnouncementId in ClineProvider for new announcements to show to users. This new id will be compared with whats in state for the 'last announcement shown', and if it's different then the announcement will render. As soon as an announcement is shown, the id will be updated in state. This ensures that announcements are not shown more than once, even if the user doesn't close it themselves.
*/
const Announcement = ({ version, hideAnnouncement }: AnnouncementProps) => {
	const { t } = useTranslation()

	return (
		<div
			style={{
				backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
				borderRadius: "3px",
				padding: "12px 16px",
				margin: "5px 15px 5px 15px",
				position: "relative",
				flexShrink: 0,
			}}>
			<VSCodeButton
				appearance="icon"
				onClick={hideAnnouncement}
				style={{ position: "absolute", top: "8px", right: "8px" }}>
				<span className="codicon codicon-close"></span>
			</VSCodeButton>
			<h2 style={{ margin: "0 0 8px" }}>{t("announcement.title")}</h2>

			<p style={{ margin: "5px 0px" }}>{t("update")}</p>
			<h3 style={{ margin: "12px 0 8px" }}>{t("customModesTitle")}</h3>
			<Trans
				i18nKey="customModesIntro"
				components={{
					Icon: <span className="codicon codicon-notebook" style={{ fontSize: "10px" }}></span>,
				}}
			/>

			<h3 style={{ margin: "12px 0 8px" }}>{t("nextChapterInvitation")}</h3>
			<Trans
				i18nKey="shareCustomModes"
				components={{
					RedditLink: <VSCodeLink href="https://www.reddit.com/r/RooCode" style={{ display: "inline" }} />,
				}}
			/>
		</div>
	)
}

export default memo(Announcement)
