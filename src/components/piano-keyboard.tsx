import { memo, useEffect, useMemo } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';

type Highlight = 'correct' | 'wrong' | 'play' | 'std' | undefined;
const KEY_STATES = {
  correct: { mark: '✓', label: '正确音' }, wrong: { mark: '×', label: '错误音' },
  play: { mark: '▶', label: '正在播放' }, std: { mark: '●', label: '标准音' },
};

function pitchName(midi: number) {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function WhiteKey({ midi, disabled, highlight, label, onKeyPress }: {
  midi: number; disabled?: boolean; highlight: Highlight; label: string; onKeyPress?: (midi: number) => void;
}) {
  const state = highlight ? KEY_STATES[highlight] : undefined;
  const face = <View style={styles.whiteFace}>{state && <Text style={styles.keyMark}>{state.mark}</Text>}<Text style={styles.keyLabel}>{label}</Text></View>;
  if (!onKeyPress) {
    return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.whiteKey, keyColor(highlight, false)]}>{face}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`钢琴键 ${label}`}
      accessibilityValue={{ text: state?.label || '未标记' }}
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
  const state = highlight ? KEY_STATES[highlight] : undefined;
  const face = <View style={styles.blackFace}>{state && <Text style={[styles.keyMark, styles.blackMark, highlight === 'std' && styles.standardMark]}>{state.mark}</Text>}</View>;
  const style = [styles.blackKey, { left, width }, keyColor(highlight, true)];
  if (!onKeyPress) {
    return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>{face}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`钢琴键 ${label}`}
      accessibilityValue={{ text: state?.label || '未标记' }}
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
  const announcement = Object.entries(highlights).filter(([, highlight]) => highlight)
    .map(([midi, highlight]) => `${pitchName(Number(midi))}，${KEY_STATES[highlight!].label}`).join('；');
  const canAnnounce = Boolean(onKeyPress && !disabled);
  useEffect(() => {
    if (canAnnounce) AccessibilityInfo.announceForAccessibility(announcement || '播放结束');
  }, [announcement, canAnnounce]);
  return (
    <View>
      <View style={[styles.keyboard, compact && styles.compactKeyboard, disabled && styles.disabled]}>
        <View style={styles.keybed}>
          {whites.map((key) => <WhiteKey key={key.midi} midi={key.midi} disabled={disabled} highlight={highlights[key.midi]} label={pitchName(key.midi)} onKeyPress={onKeyPress} />)}
          {blacks.map((key) => <BlackKey key={key.midi} midi={key.midi} disabled={disabled} highlight={highlights[key.midi]} label={pitchName(key.midi)} left={`${Math.max(0, Math.min(100 - blackWidth, key.left * whiteWidth - blackWidth / 2))}%`} width={`${blackWidth}%`} onKeyPress={onKeyPress} />)}
        </View>
      </View>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.legend}>
        {Object.values(KEY_STATES).map((state) => <Text key={state.label} style={styles.legendText}>{state.mark} {state.label}</Text>)}
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
  compactKeyboard: { height: 116 },
  disabled: { opacity: 0.75 },
  keybed: { position: 'relative', flex: 1, flexDirection: 'row' },
  whiteKey: { flex: 1, borderWidth: 0.5, borderColor: '#BDBBB5', borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: '#FFFEFA', overflow: 'hidden' },
  whiteFace: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  blackKey: { position: 'absolute', zIndex: 2, top: 0, height: '59%', borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: '#121313', borderWidth: 0.5, borderColor: '#050506', overflow: 'hidden' },
  blackFace: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 },
  keyMark: { color: '#17372C', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  blackMark: { color: '#FFFFFF', fontSize: 10 },
  standardMark: { color: '#17372C' },
  keyLabel: { color: '#9AA0AD', fontSize: 7 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  legendText: { color: '#53645D', fontSize: 10, lineHeight: 14 },
  keyPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
});
