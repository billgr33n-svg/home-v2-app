import { useQuery } from '@tanstack/react-query';

import { fetchInventory } from '../api/inventory';

export function useInventory(householdId?: string) {
  return useQuery({
    queryKey: ['inventory', householdId],
    queryFn: () => fetchInventory(householdId as string),
    enabled: Boolean(householdId),
  });
}
