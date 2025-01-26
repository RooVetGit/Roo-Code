import { ApiConfiguration } from './api';
import { HistoryItem } from './HistoryItem';
import { Mode, ModeConfig } from './modes';
import { ExtensionState } from './ExtensionMessage';

export type ClineAskResponse = 'yesButtonClicked' | 'noButtonClicked' | 'messageResponse' | 'notification_response';

export type ApiConfigurationWithName = ApiConfiguration & {
  name: string;
};

export type WebviewMessage =
  | {
      type: 'apiConfiguration';
      configuration: ApiConfigurationWithName;
    }
  | {
      type: 'currentApiConfigName';
      name: string;
    }
  | {
      type: 'upsertApiConfiguration';
      configuration: ApiConfigurationWithName;
    }
  | {
      type: 'deleteApiConfiguration';
      name: string;
    }
  | {
      type: 'loadApiConfiguration';
      name: string;
    }
  | {
      type: 'renameApiConfiguration';
      oldName: string;
      newName: string;
      configuration: ApiConfigurationWithName;
    }
  | {
      type: 'getListApiConfiguration';
    }
  | {
      type: 'getNotificationSettings';
    }
  | {
      type: 'updateNotificationSettings';
      settings: NonNullable<ExtensionState['notificationSettings']>;
    }
  | {
      type: 'notificationSettings';
      settings: NonNullable<ExtensionState['notificationSettings']>;
     }
     | {
      type: 'sendNotification';
      notificationType: 'approval' | 'question';
      text: string;
      requestId?: string;
      metadata?: {
      	toolName?: string;
      	path?: string;
      	command?: string;
      };
     }
  | {
      type: 'listApiConfiguration';
      configurations: ApiConfiguration[];
    }
  | {
      type: 'submit';
      message: string;
    }
  | {
      type: 'cancel';
    }
  | {
      type: 'clear';
    }
  | {
      type: 'retry';
    }
  | {
      type: 'stop';
    }
  | {
      type: 'history';
      items: HistoryItem[];
    }
  | {
      type: 'openCustomModesSettings';
    }
  | {
      type: 'webviewDidLaunch';
    }
  | {
      type: 'newTask';
      text?: string;
      images?: string[];
    }
  | {
      type: 'customInstructions';
      text?: string;
    }
  | {
      type: 'alwaysAllowReadOnly';
      bool?: boolean;
    }
  | {
      type: 'alwaysAllowWrite';
      bool?: boolean;
    }
  | {
      type: 'alwaysAllowExecute';
      bool?: boolean;
    }
  | {
      type: 'alwaysAllowBrowser';
      bool?: boolean;
    }
  | {
      type: 'alwaysAllowMcp';
      bool?: boolean;
    }
  | {
      type: 'askResponse';
      askResponse?: ClineAskResponse;
      text?: string;
      images?: string[];
    }
  | {
      type: 'clearTask';
    }
  | {
      type: 'didShowAnnouncement';
    }
  | {
      type: 'selectImages';
    }
  | {
      type: 'exportCurrentTask';
    }
  | {
      type: 'showTaskWithId';
      text: string;
    }
  | {
      type: 'deleteTaskWithId';
      text: string;
    }
  | {
      type: 'exportTaskWithId';
      text: string;
    }
  | {
      type: 'resetState';
    }
  | {
      type: 'requestOllamaModels';
      text?: string;
    }
  | {
      type: 'requestLmStudioModels';
      text?: string;
    }
  | {
      type: 'requestVsCodeLmModels';
    }
  | {
      type: 'refreshGlamaModels';
    }
  | {
      type: 'refreshOpenRouterModels';
    }
  | {
      type: 'refreshOpenAiModels';
      values?: {
        baseUrl?: string;
        apiKey?: string;
      };
    }
  | {
      type: 'openImage';
      text: string;
    }
  | {
      type: 'openFile';
      text: string;
      values?: {
        create?: boolean;
        content?: string;
      };
    }
  | {
      type: 'openMention';
      text?: string;
    }
  | {
      type: 'cancelTask';
    }
  | {
      type: 'allowedCommands';
      commands: string[];
    }
  | {
      type: 'openMcpSettings';
    }
  | {
      type: 'restartMcpServer';
      text: string;
    }
  | {
      type: 'toggleToolAlwaysAllow';
      serverName: string;
      toolName: string;
      alwaysAllow: boolean;
    }
  | {
      type: 'toggleMcpServer';
      serverName: string;
      disabled: boolean;
    }
  | {
      type: 'mcpEnabled';
      bool?: boolean;
    }
  | {
      type: 'playSound';
      audioType?: string;
    }
  | {
      type: 'soundEnabled';
      bool?: boolean;
    }
  | {
      type: 'soundVolume';
      value?: number;
    }
  | {
      type: 'diffEnabled';
      bool?: boolean;
    }
  | {
      type: 'browserViewportSize';
      text?: string;
    }
  | {
      type: 'fuzzyMatchThreshold';
      value?: number;
    }
  | {
      type: 'alwaysApproveResubmit';
      bool?: boolean;
    }
  | {
      type: 'requestDelaySeconds';
      value?: number;
    }
  | {
      type: 'preferredLanguage';
      text?: string;
    }
  | {
      type: 'writeDelayMs';
      value?: number;
    }
  | {
      type: 'terminalOutputLineLimit';
      value?: number;
    }
  | {
      type: 'mode';
      text?: Mode;
    }
  | {
      type: 'updateSupportPrompt';
      values?: Record<string, any>;
    }
  | {
      type: 'resetSupportPrompt';
      text?: string;
    }
  | {
      type: 'updatePrompt';
      promptMode?: string;
      customPrompt?: any;
    }
  | {
      type: 'deleteMessage';
      value?: number;
    }
  | {
      type: 'screenshotQuality';
      value?: number;
    }
  | {
      type: 'enhancementApiConfigId';
      text?: string;
    }
  | {
      type: 'autoApprovalEnabled';
      bool?: boolean;
    }
  | {
      type: 'enhancePrompt';
      text?: string;
    }
  | {
      type: 'getSystemPrompt';
      mode?: Mode;
    }
  | {
      type: 'searchCommits';
      query?: string;
    }
  | {
      type: 'experimentalDiffStrategy';
      bool?: boolean;
    }
  | {
      type: 'updateCustomMode';
      modeConfig?: ModeConfig;
    }
  | {
      type: 'deleteCustomMode';
      slug?: string;
    };
