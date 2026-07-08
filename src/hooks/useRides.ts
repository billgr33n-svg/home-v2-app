import { useQuery } from '@tanstack/react-query';

import { fetchOpenRides } from '../api/rides';

export function useOpenRides(householdId?: string) {
  return useQuery({
    queryKey: ['rides', householdId],
    queryFn: () => fetchOpenRides(householdId as string),
    enabled: Boolean(householdId),
  });
}
