import { useQuery } from '@tanstack/react-query';

import { fetchUpcomingEvents } from '../api/events';

export function useEvents(householdId?: string) {
  return useQuery({
    queryKey: ['events', householdId],
    queryFn: () => fetchUpcomingEvents(householdId as string),
    enabled: Boolean(householdId),
  });
}
