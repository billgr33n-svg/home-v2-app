import { useQuery } from '@tanstack/react-query';

import { fetchMyMemberships } from '../api/households';

export function useMyMemberships() {
  return useQuery({
    queryKey: ['memberships'],
    queryFn: fetchMyMemberships,
  });
}
