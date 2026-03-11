import { defineExtensionMessaging } from '@webext-core/messaging';

import type {
  ApplyBookmarkSuggestionRequest,
  BookmarkSuggestionUpdatePayload,
  ContinueBookmarkRecommendationRequest,
  DeleteLowQualityBookmarkRequest,
  DismissBookmarkQualityWarningRequest,
  DismissDuplicateBookmarkRequest,
  GetPageContentRequest,
  OpenBookmarkRequest,
  PageContent,
  RejectBookmarkSuggestionRequest,
  ResolveDuplicateBookmarkRequest,
} from './types';

export interface ProtocolMap {
  bookmarkSuggestionUpdate(payload: BookmarkSuggestionUpdatePayload): void;
  getPageContent(payload: GetPageContentRequest): PageContent;
  applyBookmarkSuggestion(payload: ApplyBookmarkSuggestionRequest): void;
  rejectBookmarkSuggestion(payload: RejectBookmarkSuggestionRequest): void;
  resolveDuplicateBookmark(payload: ResolveDuplicateBookmarkRequest): void;
  dismissDuplicateBookmark(payload: DismissDuplicateBookmarkRequest): void;
  continueBookmarkRecommendation(payload: ContinueBookmarkRecommendationRequest): void;
  dismissBookmarkQualityWarning(payload: DismissBookmarkQualityWarningRequest): void;
  deleteLowQualityBookmark(payload: DeleteLowQualityBookmarkRequest): void;
  openBookmark(payload: OpenBookmarkRequest): void;
  openOptions(): void;
}

export const messaging = defineExtensionMessaging<ProtocolMap>();
