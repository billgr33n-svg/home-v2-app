import { useQuery } from '@tanstack/react-query';

import { fetchItemSuggestions } from '../api/shopping';

export function useItemSuggestions(householdId?: string) {
  return useQuery({
    queryKey: ['itemSuggestions', householdId],
    queryFn: () => fetchItemSuggestions(householdId as string),
    enabled: Boolean(householdId),
  });
}
