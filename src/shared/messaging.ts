import { defineExtensionMessaging } from '@webext-core/messaging';

import type {
  BookmarkCardUpdatePayload,
  GetPageContentRequest,
  PageContent,
  SubmitBookmarkCardActionRequest,
} from './types';

export interface ProtocolMap {
  bookmarkCardUpdate(payload: BookmarkCardUpdatePayload): void;
  submitBookmarkCardAction(payload: SubmitBookmarkCardActionRequest): void;
  getPageContent(payload: GetPageContentRequest): PageContent;
  openOptions(): void;
}

export const messaging = defineExtensionMessaging<ProtocolMap>();
