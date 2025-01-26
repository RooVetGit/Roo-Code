import { ApiConfiguration } from './api';
import { HistoryItem } from './HistoryItem';

export type WebviewMessage =
  | {
      type: 'apiConfiguration';
      configuration: ApiConfiguration;
    }
  | {
      type: 'currentApiConfigName';
      name: string;
    }
  | {
      type: 'upsertApiConfiguration';
      configuration: ApiConfiguration;
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
    }
  | {
      type: 'getListApiConfiguration';
    }
  | {
      type: 'getNotificationSettings';
    }
  | {
      type: 'updateNotificationSettings';
      settings: {
        telegram?: {
          enabled: boolean;
          botToken: string;
          chatId: string;
          pollingInterval: number;
        };
      };
    }
  | {
      type: 'notificationSettings';
      settings: {
        telegram?: {
          enabled: boolean;
          botToken: string;
          chatId: string;
          pollingInterval: number;
        };
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
    };
