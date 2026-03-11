export type Locale = 'en' | 'zh-CN';
export type LocaleOverride = 'auto' | Locale;

export interface FlowmarkSettings {
  enabled: boolean;
  duplicateCheckEnabled: boolean;
  pageQualityFilterEnabled: boolean;
  summaryEnabled: boolean;
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
  duplicateCheckEnabled: true,
  pageQualityFilterEnabled: true,
  summaryEnabled: true,
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
  hasPasswordField: boolean;
  formFieldCount: number;
  linkCount: number;
}

export interface GetPageContentRequest {
  includeText: boolean;
  maxChars: number;
}

export interface BookmarkSuggestion {
  suggestedFolder: string;
  title: string;
  confidence: number;
  summary: string;
}

export interface DuplicateBookmarkMatch {
  id: string;
  title: string;
  url: string;
  folderPath: string;
}

export type DuplicateBookmarkAction =
  | 'keep_new'
  | 'delete_new'
  | 'move_new_to_existing_folder'
  | 'open_existing';

export type BookmarkPageQualityReason =
  | 'login_page'
  | 'search_results'
  | 'low_information_density';

export interface BookmarkPageQualityWarningPayload {
  kind: 'quality-warning';
  bookmarkId: string;
  url: string;
  title: string;
  quality: {
    reason: BookmarkPageQualityReason;
    message: string;
    detail: string;
  };
  ui: BookmarkSuggestionUiConfig;
}

export interface DuplicateBookmarkUpdatePayload {
  kind: 'duplicate';
  bookmarkId: string;
  url: string;
  title: string;
  matches: DuplicateBookmarkMatch[];
  ui: BookmarkSuggestionUiConfig;
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
    }
  | DuplicateBookmarkUpdatePayload
  | BookmarkPageQualityWarningPayload;

export interface BookmarkSuggestionUiConfig {
  autoAcceptEnabled: boolean;
  autoAcceptSeconds: number;
}

export interface ApplyBookmarkSuggestionRequest {
  bookmarkId: string;
  suggestedFolder: string;
  title: string;
  summary: string;
}

export interface RejectBookmarkSuggestionRequest {
  bookmarkId: string;
}

export interface ResolveDuplicateBookmarkRequest {
  bookmarkId: string;
  action: DuplicateBookmarkAction;
  targetBookmarkId?: string;
}

export interface DismissDuplicateBookmarkRequest {
  bookmarkId: string;
}

export interface ContinueBookmarkRecommendationRequest {
  bookmarkId: string;
}

export interface DismissBookmarkQualityWarningRequest {
  bookmarkId: string;
}

export interface DeleteLowQualityBookmarkRequest {
  bookmarkId: string;
}

export interface OpenBookmarkRequest {
  bookmarkId: string;
}

export interface BookmarkSummaryRecord {
  bookmarkId: string;
  url: string;
  normalizedUrl: string;
  title: string;
  folderPath: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
}
