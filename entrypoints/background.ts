import { initLifecyclePages } from '@/src/background/lifecycle-pages';
import { initBookmarkRecommendation } from '@/src/background/bookmark-recommendation';

export default defineBackground(() => {
  initLifecyclePages();
  initBookmarkRecommendation();
});
