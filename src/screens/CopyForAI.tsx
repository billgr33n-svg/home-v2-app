import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildInventoryPrompt, selectForExport, type ExportKind } from '../domain/exportInventory';
import type { InventoryView } from '../domain/inventory';
import { copyText } from '../lib/clipboard';
import { color, radius, space, TOUCH, type as t } from '../theme';

type Status = 'idle' | 'copied' | 'failed';

/**
 * Copy the pantry, or the bar, as a prompt.
 *
 * The count on each button is not decoration. A copy button that silently sends
 * nothing looks identical to one that worked, and the user only discovers the
 * difference after pasting into a chat window.
 */
export function CopyForAI(props: { items: readonly InventoryView[] }) {
  return (
    <View style={styles.row}>
      <CopyButton items={props.items} kind="food" label="Copy kitchen for AI" />
      <CopyButton items={props.items} kind="bar" label="Copy bar for AI" />
    </View>
  );
}

function CopyButton(props: { items: readonly InventoryView[]; kind: ExportKind; label: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const count = selectForExport(props.items, props.kind).length;

  // Reset the confirmation so the button does not sit on "Copied" forever.
  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  const onPress = async () => {
    // Must run inside the gesture: navigator.clipboard rejects otherwise.
    const ok = await copyText(buildInventoryPrompt(props.items, props.kind));
    setStatus(ok ? 'copied' : 'failed');
  };

  const disabled = count === 0;
  const label =
    status === 'copied' ? `Copied ${count} items` : status === 'failed' ? "Couldn't copy" : props.label;

  return (
    <Pressable
      disabled={disabled}
      onPress={() => void onPress()}
      style={[
        styles.btn,
        status === 'copied' && styles.btnOk,
        status === 'failed' && styles.btnBad,
        disabled && styles.btnOff,
      ]}
    >
      <Text style={[styles.btnText, disabled && styles.btnTextOff]} numberOfLines={1}>
        {label}
      </Text>
      {status === 'idle' && !disabled ? <Text style={styles.count}>{count} items</Text> : null}
      {disabled ? <Text style={styles.count}>nothing to copy</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  btn: {
    flex: 1,
    minHeight: TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accent,
    backgroundColor: color.accentSoft,
    gap: 1,
  },
  btnOk: { borderColor: color.success, backgroundColor: color.successSoft },
  btnBad: { borderColor: color.danger, backgroundColor: color.dangerSoft },
  btnOff: { borderColor: color.border, backgroundColor: color.surfaceRaised },
  btnText: { color: color.accent, fontWeight: '700', fontSize: 14 },
  btnTextOff: { color: color.textFaint },
  count: { ...t.meta },
});
