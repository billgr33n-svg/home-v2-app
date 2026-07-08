import { useQuery } from '@tanstack/react-query';

import { fetchTodayFeed } from '../api/today';

export function useTodayFeed(householdId: string | undefined) {
  return useQuery({
    queryKey: ['today', householdId],
    queryFn: () => fetchTodayFeed(householdId as string),
    enabled: Boolean(householdId),
  });
}
