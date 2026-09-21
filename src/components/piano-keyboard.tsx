import { memo, useEffect, useMemo } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { pianoBlackKeys, pianoWhiteMidis } from '@/core/music-notation';
import { Btn } from '@/constants/button-tokens';

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
  const face = <View style={styles.whiteFace}>{state && <Text style={[styles.keyMark, highlight === 'std' && styles.standardMark]}>{state.mark}</Text>}<Text style={[styles.keyLabel, highlight && highlight !== 'std' && styles.highlightedLabel]}>{label}</Text></View>;
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
      style={({ pressed }) => [styles.whiteKey, keyColor(highlight, false), pressed && !highlight && styles.whitePressed, pressed && styles.keyPressed]}>
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
      style={({ pressed }) => [...style, pressed && !highlight && styles.blackPressed, pressed && styles.keyPressed]}>
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
    return { whites: pianoWhiteMidis(startMidi, endMidi), blacks: pianoBlackKeys(startMidi, endMidi) };
  }, [startMidi, endMidi]);
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
          {whites.map((midi) => <WhiteKey key={midi} midi={midi} disabled={disabled} highlight={highlights[midi]} label={pitchName(midi)} onKeyPress={onKeyPress} />)}
          {blacks.map((key) => <BlackKey key={key.midi} midi={key.midi} disabled={disabled} highlight={highlights[key.midi]} label={pitchName(key.midi)} left={`${key.leftPercent}%`} width={`${key.widthPercent}%`} onKeyPress={onKeyPress} />)}
        </View>
      </View>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.legend}>
        {Object.values(KEY_STATES).map((state) => <Text key={state.label} style={styles.legendText}>{state.mark} {state.label}</Text>)}
      </View>
    </View>
  );
});

function keyColor(highlight: Highlight, black: boolean) {
  if (highlight === 'correct') return { backgroundColor: '#2E8B6F' };
  if (highlight === 'wrong') return { backgroundColor: '#C65D54' };
  if (highlight === 'std') return { backgroundColor: black ? '#FAAD14' : '#FFE58F' };
  if (highlight === 'play') return { backgroundColor: '#1F6F5B' };
  return undefined;
}

const styles = StyleSheet.create({
  // 小程序 .keyboard 300rpx / 5rpx / 7rpx
  keyboard: { width: '100%', ...Btn.piano.keyboard, backgroundColor: '#0C0D10' },
  compactKeyboard: { height: 116 },
  disabled: { opacity: 0.72 },
  keybed: { position: 'relative', flex: 1, flexDirection: 'row' },
  // 小程序 .white border-radius 1rpx 1rpx 3rpx 3rpx
  whiteKey: { flex: 1, borderWidth: 0.5, borderColor: '#BDBBB5', ...Btn.piano.whiteKey, backgroundColor: '#FFFEFA', overflow: 'hidden' },
  whiteFace: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  // 小程序 .black height 59% / border-radius 0 0 2rpx 2rpx
  blackKey: { position: 'absolute', zIndex: 2, top: 0, height: '59%', ...Btn.piano.blackKey, backgroundColor: '#121313', borderWidth: 0.5, borderColor: '#050506', overflow: 'hidden' },
  blackFace: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 },
  /** 键位对错标记为 App 独有，小程序无对应字样 */
  keyMark: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  blackMark: { fontSize: 10 },
  standardMark: { color: '#17372C' },
  keyLabel: { color: '#9AA0AD', ...Btn.piano.keyLabel },
  highlightedLabel: { color: '#FFFFFF' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  legendText: { color: '#53645D', fontSize: 10, lineHeight: 14 },
  whitePressed: { backgroundColor: '#E7F2EE' },
  blackPressed: { backgroundColor: '#2E8B6F' },
  keyPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
});
