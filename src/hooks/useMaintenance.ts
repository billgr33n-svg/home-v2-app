import { useQuery } from '@tanstack/react-query';

import { fetchMaintenance } from '../api/maintenance';

export function useMaintenance(householdId?: string) {
  return useQuery({
    queryKey: ['maintenance', householdId],
    queryFn: () => fetchMaintenance(householdId as string),
    enabled: Boolean(householdId),
  });
}
