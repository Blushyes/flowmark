import { initBookmarkRecommendation } from '@/src/background/bookmark-recommendation';

export default defineBackground(() => {
  initBookmarkRecommendation();
});
