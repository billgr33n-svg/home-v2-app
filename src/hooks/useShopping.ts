import { useQuery } from '@tanstack/react-query';

import { fetchShoppingList } from '../api/shopping';

export function useShoppingList(householdId?: string) {
  return useQuery({
    queryKey: ['shopping', householdId],
    queryFn: () => fetchShoppingList(householdId as string),
    enabled: Boolean(householdId),
  });
}
