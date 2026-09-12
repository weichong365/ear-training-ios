import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';

type Highlight = 'correct' | 'wrong' | 'play' | 'std' | undefined;

function pitchName(midi: number) {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function WhiteKey({ midi, disabled, highlight, label, onKeyPress }: {
  midi: number; disabled?: boolean; highlight: Highlight; label: string; onKeyPress?: (midi: number) => void;
}) {
  const face = <View style={styles.whiteFace}><Text style={styles.keyLabel}>{label}</Text></View>;
  if (!onKeyPress) {
    return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.whiteKey, keyColor(highlight, false)]}>{face}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`钢琴键 ${label}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onKeyPress(midi)}
      style={({ pressed }) => [styles.whiteKey, keyColor(highlight, false), pressed && styles.keyPressed]}>
      {face}
    </Pressable>
  );
}

function BlackKey({ midi, disabled, highlight, label, left, width, onKeyPress }: {
  midi: number; disabled?: boolean; highlight: Highlight; label: string; left: DimensionValue; width: DimensionValue; onKeyPress?: (midi: number) => void;
}) {
  const face = <View style={styles.blackFace} />;
  const style = [styles.blackKey, { left, width }, keyColor(highlight, true)];
  if (!onKeyPress) {
    return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>{face}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`钢琴键 ${label}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onKeyPress(midi)}
      style={({ pressed }) => [...style, pressed && styles.keyPressed]}>
      {face}
    </Pressable>
  );
}

export const PianoKeyboard = memo(function PianoKeyboard({
  startMidi = 55,
  endMidi = 81,
  compact = false,
  disabled,
  highlights = {},
  onKeyPress,
}: {
  startMidi?: number;
  endMidi?: number;
  compact?: boolean;
  disabled?: boolean;
  volume?: number;
  highlights?: Record<number, Highlight>;
  onKeyPress?: (midi: number) => void;
}) {
  const { whites, blacks } = useMemo(() => {
    const whiteValues: { midi: number; whiteIndex: number }[] = [];
    const blackValues: { midi: number; left: number }[] = [];
    let whiteIndex = 0;
    for (let midi = startMidi; midi <= endMidi; midi += 1) {
      if ([1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)) blackValues.push({ midi, left: whiteIndex });
      else whiteValues.push({ midi, whiteIndex: whiteIndex++ });
    }
    return { whites: whiteValues, blacks: blackValues };
  }, [startMidi, endMidi]);
  const whiteWidth = 100 / Math.max(1, whites.length);
  const blackWidth = whiteWidth * 0.55;
  return (
    <View style={[styles.keyboard, compact && styles.compactKeyboard, disabled && styles.disabled]}>
      <View style={styles.keybed}>
        {whites.map((key) => <WhiteKey key={key.midi} midi={key.midi} disabled={disabled} highlight={highlights[key.midi]} label={pitchName(key.midi)} onKeyPress={onKeyPress} />)}
        {blacks.map((key) => <BlackKey key={key.midi} midi={key.midi} disabled={disabled} highlight={highlights[key.midi]} label={pitchName(key.midi)} left={`${Math.max(0, Math.min(100 - blackWidth, key.left * whiteWidth - blackWidth / 2))}%`} width={`${blackWidth}%`} onKeyPress={onKeyPress} />)}
      </View>
    </View>
  );
});

function keyColor(highlight: Highlight, black: boolean) {
  if (highlight === 'correct') return { backgroundColor: black ? '#2e8b6f' : '#e2f2ec' };
  if (highlight === 'wrong') return { backgroundColor: black ? '#E5484D' : '#FFD3D3' };
  if (highlight === 'std') return { backgroundColor: black ? '#FAAD14' : '#FFE58F' };
  if (highlight === 'play') return { backgroundColor: black ? '#1f6f5b' : '#e7f2ee' };
  return undefined;
}

const styles = StyleSheet.create({
  keyboard: { height: 155, padding: 3, borderRadius: 10, backgroundColor: '#0C0D10' },
  compactKeyboard: { height: 104 },
  disabled: { opacity: 0.75 },
  keybed: { position: 'relative', flex: 1, flexDirection: 'row' },
  whiteKey: { flex: 1, borderWidth: 0.5, borderColor: '#BDBBB5', borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: '#FFFEFA', overflow: 'hidden' },
  whiteFace: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  blackKey: { position: 'absolute', zIndex: 2, top: 0, height: '59%', borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: '#121313', borderWidth: 0.5, borderColor: '#050506', overflow: 'hidden' },
  blackFace: { flex: 1 },
  keyLabel: { color: '#9AA0AD', fontSize: 7 },
  keyPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
});
