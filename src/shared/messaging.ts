import { defineExtensionMessaging } from '@webext-core/messaging';

import type {
  ApplyBookmarkSuggestionRequest,
  BookmarkSuggestionUpdatePayload,
  GetPageContentRequest,
  PageContent,
  RejectBookmarkSuggestionRequest,
} from './types';

export interface ProtocolMap {
  bookmarkSuggestionUpdate(payload: BookmarkSuggestionUpdatePayload): void;
  getPageContent(payload: GetPageContentRequest): PageContent;
  applyBookmarkSuggestion(payload: ApplyBookmarkSuggestionRequest): void;
  rejectBookmarkSuggestion(payload: RejectBookmarkSuggestionRequest): void;
  openOptions(): void;
}

export const messaging = defineExtensionMessaging<ProtocolMap>();

