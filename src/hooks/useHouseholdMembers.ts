import { useQuery } from '@tanstack/react-query';

import { fetchHouseholdMembers } from '../api/members';

export function useHouseholdMembers(householdId?: string) {
  return useQuery({
    queryKey: ['members', householdId],
    queryFn: () => fetchHouseholdMembers(householdId as string),
    enabled: Boolean(householdId),
  });
}
