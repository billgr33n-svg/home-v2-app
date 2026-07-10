import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  claimShift, completeShift, copyKitchenWeek, coverShift, fetchKitchenWeek, releaseShift,
} from '../api/kitchen';
import { toIsoDate } from '../domain/kitchen';

export function useKitchenWeek(householdId: string, weekStartDate: Date) {
  return useQuery({
    queryKey: ['kitchen', householdId, toIsoDate(weekStartDate)],
    queryFn: () => fetchKitchenWeek(householdId, weekStartDate),
    // A signup board is contended. Refetch aggressively so two people are not
    // looking at the same stale version and both losing the race.
    staleTime: 5_000,
  });
}

/**
 * Every mutation invalidates the whole week rather than patching one row.
 *
 * Optimistic updates are exactly wrong here: the server is the arbiter of who
 * got the slot, and showing "you got it!" before it says so is a lie half the
 * time two people tap at once.
 */
function useShiftMutation<T>(householdId: string, weekStartDate: Date, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['kitchen', householdId, toIsoDate(weekStartDate)] });
      void qc.invalidateQueries({ queryKey: ['today', householdId] });
    },
  });
}

export function useClaimShift(householdId: string, weekStartDate: Date) {
  return useShiftMutation(householdId, weekStartDate, (v: { id: string; version: number }) =>
    claimShift(v.id, v.version),
  );
}

export function useReleaseShift(householdId: string, weekStartDate: Date) {
  return useShiftMutation(householdId, weekStartDate, (v: { id: string; version: number }) =>
    releaseShift(v.id, v.version),
  );
}

export function useCoverShift(householdId: string, weekStartDate: Date) {
  return useShiftMutation(householdId, weekStartDate, (v: { id: string; userId: string; version: number }) =>
    coverShift(v.id, v.userId, v.version),
  );
}

export function useCompleteShift(householdId: string, weekStartDate: Date) {
  return useShiftMutation(householdId, weekStartDate, (v: { id: string; version: number }) =>
    completeShift(v.id, v.version),
  );
}

export function useCopyWeek(householdId: string, weekStartDate: Date) {
  return useShiftMutation(householdId, weekStartDate, (v: { from: Date; to: Date }) =>
    copyKitchenWeek(householdId, v.from, v.to),
  );
}
