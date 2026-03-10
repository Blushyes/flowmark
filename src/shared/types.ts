export type Locale = 'en' | 'zh-CN';
export type LocaleOverride = 'auto' | Locale;

export interface FlowmarkSettings {
  enabled: boolean;
  autoAcceptEnabled: boolean;
  autoAcceptSeconds: number;
  sendPageText: boolean;
  maxPageChars: number;
  aiBaseURL: string;
  aiApiKey: string;
  aiModel: string;
  localeOverride: LocaleOverride;
}

export const DEFAULT_SETTINGS: FlowmarkSettings = {
  enabled: true,
  autoAcceptEnabled: true,
  autoAcceptSeconds: 5,
  sendPageText: false,
  maxPageChars: 5000,
  aiBaseURL: '',
  aiApiKey: '',
  aiModel: '',
  localeOverride: 'auto',
};

export interface PageContent {
  url: string;
  title: string;
  description: string;
  headings: string[];
  text: string | null;
}

export interface GetPageContentRequest {
  includeText: boolean;
  maxChars: number;
}

export interface BookmarkSuggestion {
  suggestedFolder: string;
  title: string;
  confidence: number;
}

export type BookmarkSuggestionUpdatePayload =
  | {
      kind: 'loading';
      bookmarkId: string;
      url: string;
      title: string;
      ui: BookmarkSuggestionUiConfig;
    }
  | {
      kind: 'ready';
      bookmarkId: string;
      url: string;
      title: string;
      suggestion: BookmarkSuggestion;
      ui: BookmarkSuggestionUiConfig;
    }
  | {
      kind: 'error';
      bookmarkId: string;
      url: string;
      title: string;
      message: string;
      ui: BookmarkSuggestionUiConfig;
      canOpenOptions: boolean;
    };

export interface BookmarkSuggestionUiConfig {
  autoAcceptEnabled: boolean;
  autoAcceptSeconds: number;
}

export interface ApplyBookmarkSuggestionRequest {
  bookmarkId: string;
  suggestedFolder: string;
  title: string;
}

export interface RejectBookmarkSuggestionRequest {
  bookmarkId: string;
}
