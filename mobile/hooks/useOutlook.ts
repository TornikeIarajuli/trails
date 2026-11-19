import { useQuery } from '@tanstack/react-query';
import { outlookService } from '../services/outlook';
import { queryKeys } from '../utils/queryKeys';

/** The good hiking days ahead (the outlook is worked out once a day). */
export function useOutlook(days = 3, enabled = true) {
  return useQuery({
    queryKey: queryKeys.outlook(days),
    queryFn: () => outlookService.goodDays(days),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
