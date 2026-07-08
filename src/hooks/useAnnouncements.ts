import { useQuery } from '@tanstack/react-query';

import { fetchAnnouncements } from '../api/announcements';

export function useAnnouncements(householdId?: string) {
  return useQuery({
    queryKey: ['announcements', householdId],
    queryFn: () => fetchAnnouncements(householdId as string),
    enabled: Boolean(householdId),
  });
}
