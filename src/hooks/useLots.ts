import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addLot, consumeLot, fetchLots, updateLotExpiry, type NewLot } from '../api/lots';

export function useLots(householdId: string) {
  return useQuery({
    queryKey: ['lots', householdId],
    queryFn: () => fetchLots(householdId),
  });
}

/**
 * Consuming a lot moves the inventory ledger too, so both caches must go.
 * Invalidating only `lots` leaves the Inventory screen showing a balance the
 * database no longer holds.
 */
export function useConsumeLot(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Parameters<typeof consumeLot>) => consumeLot(...v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lots', householdId] });
      void qc.invalidateQueries({ queryKey: ['inventory', householdId] });
      void qc.invalidateQueries({ queryKey: ['waste', householdId] });
      void qc.invalidateQueries({ queryKey: ['today', householdId] });
    },
  });
}

export function useAddLot(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lot: NewLot) => addLot(householdId, lot),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lots', householdId] }),
  });
}

export function useUpdateLotExpiry(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { lotId: string; expiresOn: string | null }) => updateLotExpiry(v.lotId, v.expiresOn),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lots', householdId] }),
  });
}
