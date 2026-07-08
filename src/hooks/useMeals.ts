import { useQuery } from '@tanstack/react-query';

import { fetchMeals } from '../api/meals';

export function useMeals(householdId?: string) {
  return useQuery({
    queryKey: ['meals', householdId],
    queryFn: () => fetchMeals(householdId as string),
    enabled: Boolean(householdId),
  });
}
