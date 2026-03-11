import type {
  BookmarkActionStore,
  BookmarkDecisionCard,
  BookmarkEvaluationContext,
  BookmarkEvaluationState,
  BookmarkPolicyContinuation,
  PageContent,
} from '@/src/shared/types';

export interface BookmarkJob {
  bookmarkId: string;
  url: string;
  originalTitle: string;
  tabId: number;
  pageContentPromise: Promise<PageContent>;
  context?: BookmarkEvaluationContext;
  state: BookmarkEvaluationState;
  continuation?: BookmarkPolicyContinuation;
  activeCard?: BookmarkDecisionCard;
}

export class BookmarkEvaluationStore implements BookmarkActionStore {
  readonly jobs = new Map<string, BookmarkJob>();
  readonly queue: string[] = [];
  readonly suppressions = new Map<string, number>();
  readonly activeCards = new Map<string, BookmarkDecisionCard>();
  private draining = false;

  setJob(job: BookmarkJob): void {
    this.jobs.set(job.bookmarkId, job);
  }

  getJob(bookmarkId: string): BookmarkJob | undefined {
    return this.jobs.get(bookmarkId);
  }

  removeJob(bookmarkId: string): void {
    this.jobs.delete(bookmarkId);
    this.activeCards.delete(bookmarkId);
  }

  enqueue(bookmarkId: string): void {
    this.queue.push(bookmarkId);
  }

  dequeue(): string | undefined {
    return this.queue.shift();
  }

  setState(bookmarkId: string, state: BookmarkEvaluationState): void {
    const job = this.jobs.get(bookmarkId);
    if (!job) return;
    job.state = state;
  }

  setContinuation(bookmarkId: string, continuation?: BookmarkPolicyContinuation): void {
    const job = this.jobs.get(bookmarkId);
    if (!job) return;
    job.continuation = continuation;
  }

  setContext(bookmarkId: string, context: BookmarkEvaluationContext): void {
    const job = this.jobs.get(bookmarkId);
    if (!job) return;
    job.context = context;
  }

  getContext(bookmarkId: string): BookmarkEvaluationContext | undefined {
    return this.jobs.get(bookmarkId)?.context;
  }

  setActiveCard(bookmarkId: string, card?: BookmarkDecisionCard): void {
    if (!card) {
      this.activeCards.delete(bookmarkId);
      const job = this.jobs.get(bookmarkId);
      if (job) job.activeCard = undefined;
      return;
    }

    this.activeCards.set(bookmarkId, card);
    const job = this.jobs.get(bookmarkId);
    if (job) job.activeCard = card;
  }

  getActiveCard(bookmarkId: string): BookmarkDecisionCard | undefined {
    return this.activeCards.get(bookmarkId);
  }

  suppress(bookmarkId: string, durationMs: number): void {
    this.suppressions.set(bookmarkId, Date.now() + durationMs);
  }

  isSuppressed(bookmarkId: string): boolean {
    const until = this.suppressions.get(bookmarkId);
    if (until == null) return false;
    if (Date.now() < until) return true;
    this.suppressions.delete(bookmarkId);
    return false;
  }

  startDraining(): boolean {
    if (this.draining) return false;
    this.draining = true;
    return true;
  }

  finishDraining(): void {
    this.draining = false;
  }
}
