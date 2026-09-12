import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import type { PracticeType } from '@/core';
import { Brand, Radius, TouchTarget, TypeScale } from '@/constants/theme';
import { getWrongRecords, removeWrongRecord, type WrongRecord } from '@/services/local-data';

const TYPE_ORDER: PracticeType[] = ['single', 'group', 'interval', 'connection', 'chord', 'chordQuality', 'chordPitch', 'rhythm', 'melody'];

export default function WrongbookScreen() {
  const [items, setItems] = useState<WrongRecord[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const refresh = useCallback(() => { getWrongRecords().then(setItems); }, []);
  useFocusEffect(refresh);

  const groups = useMemo(() => TYPE_ORDER.map((type) => {
    const values = items.filter((item) => item.type === type);
    return { type, name: values[0]?.typeName || type, values };
  }).filter((group) => group.values.length), [items]);
  const totalErrors = items.reduce((sum, item) => sum + item.errorCount, 0);

  async function remove(id: string) {
    await removeWrongRecord(id);
    refresh();
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><AppIcon name="wrongbook" size={28} color={Brand.textOnAccent} /></View>
        <View style={styles.heroCopy}><Text style={styles.title}>错题复盘</Text><Text style={styles.subtitle}>把每次失误，变成下一次进步</Text></View>
      </View>

      {items.length ? <>
        <View style={styles.summary}>
          <View style={styles.summaryItem}><Text style={styles.summaryMain}>{items.length}</Text><Text style={styles.summaryLabel}>薄弱考点</Text></View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}><Text style={[styles.summaryMain, styles.coral]}>{totalErrors}</Text><Text style={styles.summaryLabel}>累计错误</Text></View>
          <Text style={styles.summaryHint}>强化答对后自动移除</Text>
        </View>

        <Text style={styles.listTitle}>按题型归类</Text>
        {groups.map((group, groupIndex) => {
          const isOpen = expanded[group.type] ?? false;
          return (
            <View key={group.type} style={styles.group}>
              <View style={styles.groupHead}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${group.name}，${group.values.length} 个错题`}
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() => setExpanded((value) => ({ ...value, [group.type]: !isOpen }))}
                  style={({ pressed }) => [styles.groupToggle, pressed && styles.pressed]}>
                  <View style={styles.dot} />
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupCount}>{group.values.length}</Text>
                  <AppIcon name={isOpen ? 'chevronUp' : 'chevronDown'} size={16} color={Brand.muted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`练习${group.name}新题`}
                  onPress={() => router.push({ pathname: '/practice', params: { type: group.type } })}
                  style={({ pressed }) => [styles.groupPracticeButton, pressed && styles.pressed]}>
                  <Text style={styles.groupPractice}>练习新题</Text>
                </Pressable>
              </View>

              {isOpen && <View style={styles.groupBody}>{group.values.map((item, index) => (
                <View key={item.id} style={styles.wrongItem}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.answerText}，错误 ${item.errorCount} 次，开始强化`}
                    onPress={() => router.push({ pathname: '/practice', params: { type: item.type, wrongId: item.id } })}
                    style={({ pressed }) => [styles.wrongMain, pressed && styles.pressed]}>
                    <View style={styles.index}><Text style={styles.indexText}>{index + 1}</Text></View>
                    <View style={styles.itemCopy}><Text numberOfLines={1} style={styles.answer}>{item.answerText}</Text><Text style={styles.meta}>错 {item.errorCount} 次 · 最近 {new Date(item.lastWrongAt).toLocaleDateString('zh-CN')}</Text></View>
                    <Text style={styles.reviewText}>强化</Text>
                    <AppIcon name="chevronRight" size={14} color={Brand.forest} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`移除错题 ${item.answerText}`} onPress={() => void remove(item.id)} style={styles.removeButton}>
                    <AppIcon name="delete" size={18} color={Brand.muted} />
                  </Pressable>
                </View>
              ))}</View>}
            </View>
          );
        })}
      </> : <View style={styles.empty}>
        <View style={styles.emptyIcon}><AppIcon name="check" size={36} /></View>
        <Text style={styles.emptyTitle}>目前没有错题</Text>
        <Text style={styles.emptyText}>保持状态，开始一组新的训练吧</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/practice', params: { type: 'adaptive' } })} style={styles.emptyButton}><Text style={styles.emptyButtonText}>开始综合练习</Text></Pressable>
      </View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.cream },
  content: { padding: 16, paddingBottom: 44, gap: 14 },
  hero: { minHeight: 104, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: Radius.hero, backgroundColor: Brand.forest },
  heroIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.card, backgroundColor: 'rgba(255,255,255,.14)' },
  heroCopy: { flex: 1 },
  title: { color: Brand.textOnAccent, fontSize: TypeScale.title2, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { marginTop: 5, color: Brand.textOnAccentMuted, fontSize: TypeScale.footnote },
  summary: { padding: 14, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border },
  summaryItem: { minWidth: 58, alignItems: 'center' },
  summaryMain: { color: Brand.forest, fontSize: TypeScale.title2, fontWeight: '900', fontVariant: ['tabular-nums'] },
  coral: { color: Brand.danger },
  summaryLabel: { marginTop: 2, color: Brand.muted, fontSize: TypeScale.caption },
  divider: { width: StyleSheet.hairlineWidth, height: 42, marginHorizontal: 14, backgroundColor: Brand.divider },
  summaryHint: { flex: 1, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 17, textAlign: 'right' },
  listTitle: { marginTop: 2, color: Brand.ink, fontSize: TypeScale.headline, fontWeight: '900' },
  group: { overflow: 'hidden', borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.ivory },
  groupHead: { minHeight: 60, paddingLeft: 14, flexDirection: 'row', alignItems: 'center' },
  groupToggle: { minHeight: 60, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.forest },
  groupName: { color: Brand.ink, fontSize: TypeScale.subheadline, fontWeight: '900' },
  groupCount: { minWidth: 25, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', color: Brand.forest, backgroundColor: Brand.forestSoft, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  groupPracticeButton: { minHeight: TouchTarget, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  groupPractice: { color: Brand.forest, fontSize: TypeScale.caption, fontWeight: '800' },
  groupBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.divider },
  wrongItem: { minHeight: 70, flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.divider },
  wrongMain: { minHeight: 70, flex: 1, paddingLeft: 12, flexDirection: 'row', alignItems: 'center' },
  index: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: Brand.forestSoft },
  indexText: { color: Brand.forest, fontSize: TypeScale.caption, fontWeight: '800', fontVariant: ['tabular-nums'] },
  itemCopy: { flex: 1, minWidth: 0, marginHorizontal: 10 },
  answer: { color: Brand.ink, fontSize: TypeScale.footnote, fontWeight: '800' },
  meta: { marginTop: 4, color: Brand.muted, fontSize: TypeScale.caption },
  reviewText: { marginRight: 3, color: Brand.forest, fontSize: TypeScale.caption, fontWeight: '800' },
  removeButton: { width: TouchTarget, minHeight: 70, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: 24, padding: 34, alignItems: 'center', borderRadius: Radius.hero, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border },
  emptyIcon: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.hero, backgroundColor: Brand.forestSoft },
  emptyTitle: { marginTop: 16, color: Brand.ink, fontSize: TypeScale.headline, fontWeight: '900' },
  emptyText: { marginTop: 7, color: Brand.muted, fontSize: TypeScale.footnote, textAlign: 'center' },
  emptyButton: { minWidth: 190, minHeight: 48, marginTop: 20, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forest },
  emptyButtonText: { color: Brand.textOnAccent, fontSize: TypeScale.subheadline, fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
