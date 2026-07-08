import { useQuery } from '@tanstack/react-query';

import { fetchPolls } from '../api/polls';

export function usePolls(householdId?: string) {
  return useQuery({
    queryKey: ['polls', householdId],
    queryFn: () => fetchPolls(householdId as string),
    enabled: Boolean(householdId),
  });
}
