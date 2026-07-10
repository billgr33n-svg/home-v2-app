import { useQuery } from '@tanstack/react-query';

import { daysAgo, fetchWasteReport } from '../api/waste';

export function useWaste(householdId: string, windowDays: number) {
  return useQuery({
    queryKey: ['waste', householdId, windowDays],
    queryFn: () => fetchWasteReport(householdId, daysAgo(windowDays)),
  });
}
