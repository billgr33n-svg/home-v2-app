import { useQuery } from '@tanstack/react-query';

import { fetchLocations } from '../api/locations';

export function useLocations(householdId?: string) {
  return useQuery({
    queryKey: ['locations', householdId],
    queryFn: () => fetchLocations(householdId as string),
    enabled: Boolean(householdId),
  });
}
