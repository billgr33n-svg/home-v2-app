import { useQuery } from '@tanstack/react-query';

import { fetchOpenTasks } from '../api/tasks';

export function useTasks(householdId?: string) {
  return useQuery({
    queryKey: ['tasks', householdId],
    queryFn: () => fetchOpenTasks(householdId as string),
    enabled: Boolean(householdId),
  });
}
