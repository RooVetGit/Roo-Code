import { VSCodeButton, VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { useExtensionState } from "../../context/ExtensionStateContext";
import { vscode } from "../../utils/vscode";

type NotificationsViewProps = {
    onDone: () => void
}

const NotificationsView = ({ onDone }: NotificationsViewProps) => {
    const handleSubmit = () => {
        vscode.postMessage({ type: "messagingConfig", messagingConfig });
        onDone();
    };

    const {
        messagingConfig: rawMessagingConfig,
        setMessagingConfig,
        soundEnabled,
        setSoundEnabled,
        soundVolume,
        setSoundVolume
    } = useExtensionState();

    // Ensure we always have a valid config object
    const messagingConfig = rawMessagingConfig ?? {
        telegramBotToken: undefined,
        telegramChatId: undefined,
        notificationsEnabled: false
    };

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                padding: "10px 0px 0px 20px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "17px",
                paddingRight: 17,
            }}>
                <h3 style={{ color: "var(--vscode-foreground)", margin: 0 }}>Notification Settings</h3>
                <VSCodeButton onClick={handleSubmit}>Done</VSCodeButton>
            </div>
            <div style={{ marginBottom: 15 }}>
                
                <div style={{ marginBottom: 15 }}>
                    <VSCodeCheckbox
                        checked={messagingConfig?.notificationsEnabled ?? false}
                        onChange={(e: any) => setMessagingConfig({
                            telegramBotToken: messagingConfig.telegramBotToken,
                            telegramChatId: messagingConfig.telegramChatId,
                            notificationsEnabled: e.target.checked
                        })}>
                        <span style={{ fontWeight: "500" }}>Enable external notifications</span>
                    </VSCodeCheckbox>
                    <p style={{
                        fontSize: "12px",
                        marginTop: "5px",
                        color: "var(--vscode-descriptionForeground)",
                    }}>
                        When enabled, Cline will send notifications to configured messaging services when tasks are completed.
                    </p>
                </div>

                {messagingConfig?.notificationsEnabled && (
                    <div style={{ marginLeft: 20, marginBottom: 15 }}>
                        <h4 style={{ margin: "0 0 10px 0" }}>Messaging Services</h4>
                        
                        <div style={{ marginBottom: 10 }}>
                            <label style={{ fontWeight: "500", display: "block", marginBottom: 5 }}>Telegram</label>
                            <VSCodeTextField
                                value={messagingConfig?.telegramBotToken ?? ""}
                                placeholder="Bot Token"
                                style={{ width: "100%", marginBottom: 5 }}
                                onInput={(e: any) => setMessagingConfig({
                                    telegramBotToken: e.target.value,
                                    telegramChatId: messagingConfig.telegramChatId,
                                    notificationsEnabled: messagingConfig.notificationsEnabled
                                })}
                            />
                            <VSCodeTextField
                                value={messagingConfig?.telegramChatId ?? ""}
                                placeholder="Chat ID"
                                style={{ width: "100%" }}
                                onInput={(e: any) => setMessagingConfig({
                                    telegramBotToken: messagingConfig.telegramBotToken,
                                    telegramChatId: e.target.value,
                                    notificationsEnabled: messagingConfig.notificationsEnabled
                                })}
                            />
                            <p style={{
                                fontSize: "12px",
                                marginTop: "5px",
                                color: "var(--vscode-descriptionForeground)",
                            }}>
                                Visit the README for instructions on how to set up Telegram notifications.
                            </p>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: 20 }}>
                    <VSCodeCheckbox checked={soundEnabled} onChange={(e: any) => {
                        setSoundEnabled(e.target.checked);
                        vscode.postMessage({ type: "soundEnabled", bool: e.target.checked });
                    }}>
                        <span style={{ fontWeight: "500" }}>Enable sound effects</span>
                    </VSCodeCheckbox>
                    <p style={{
                        fontSize: "12px",
                        marginTop: "5px",
                        color: "var(--vscode-descriptionForeground)",
                    }}>
                        When enabled, Cline will play sound effects for notifications and events.
                    </p>
                </div>
            </div>
            {soundEnabled && (
                <div style={{ marginLeft: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontWeight: "500", minWidth: '100px' }}>Volume</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={soundVolume ?? 0.5}
                            onChange={(e) => {
                                setSoundVolume(parseFloat(e.target.value));
                                vscode.postMessage({ type: "soundVolume", value: parseFloat(e.target.value) });
                            }}
                            style={{
                                flexGrow: 1,
                                accentColor: 'var(--vscode-button-background)',
                                height: '2px'
                            }}
                            aria-label="Volume"
                        />
                        <span style={{ minWidth: '35px', textAlign: 'left' }}>
                            {((soundVolume ?? 0.5) * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationsView;