import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { getProvincePracticeModules, hasDedicatedFramework, PROVINCES } from '@/core/provinces';
import { Brand, Radius, TouchTarget, TypeScale } from '@/constants/theme';
import { useProvince } from '@/services/province-context';

const REGION_ORDER = ['华北', '东北', '华东', '中南', '西南', '西北'];

export default function ProvinceSelectScreen() {
  const params = useLocalSearchParams<{ switch?: string }>();
  const isSwitch = params.switch === '1';
  const { provinceId, setProvince } = useProvince();

  const groups = useMemo(() => {
    const byRegion = new Map<string, { id: string; label: string; dedicated: boolean; summary: string }[]>();
    PROVINCES.forEach((province) => {
      const modules = getProvincePracticeModules(province.id);
      const item = {
        id: province.id,
        label: province.label,
        dedicated: hasDedicatedFramework(province.id),
        summary: modules.slice(0, 3).map((module) => module.name).join(' · ') || '该省题型整理中',
      };
      if (!byRegion.has(province.region)) byRegion.set(province.region, []);
      byRegion.get(province.region)!.push(item);
    });
    return REGION_ORDER.filter((region) => byRegion.has(region))
      .map((region) => ({ region, list: byRegion.get(region)! }));
  }, []);

  async function choose(id: string) {
    void Haptics.selectionAsync();
    try {
      await setProvince(id as typeof PROVINCES[number]['id']);
    } catch {
      Alert.alert('省份未能保存', '本次选择已经生效，但下次打开 App 可能需要重新选择。请检查设备存储后重试。');
    }
    if (isSwitch) router.back();
    else router.replace('/');
  }

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.nav}>
          {isSwitch ? (
            <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => router.back()} style={styles.back}>
              <AppIcon name="chevronLeft" size={22} color={Brand.ink} />
            </Pressable>
          ) : <View style={styles.back} />}
          <Text style={styles.navTitle}>{isSwitch ? '切换省份' : '选择省份'}</Text>
          <View style={styles.back} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.title}>先选你所在的省份</Text>
          <Text style={styles.sub}>系统会按该省音乐统考的题型，生成对应的专项练习模块</Text>
        </View>

        {groups.map((group) => (
          <View key={group.region} style={styles.regionBlock}>
            <Text style={styles.regionTitle}>{group.region}</Text>
            <View style={styles.grid}>
              {group.list.map((province) => (
                <Pressable
                  key={province.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`选择${province.label}`}
                  accessibilityHint={province.dedicated ? province.summary : '使用全国通用模板'}
                  accessibilityState={{ selected: provinceId === province.id }}
                  onPress={() => choose(province.id)}
                  style={({ pressed }) => [styles.card, provinceId === province.id && styles.cardSelected, pressed && styles.pressed]}>
                  <View style={styles.cardHead}>
                    <View style={styles.cardNameRow}>
                      <Text style={styles.cardName}>{province.label}</Text>
                      {!province.dedicated && <Text style={styles.genericTag}>通用模板</Text>}
                    </View>
                    <AppIcon name={provinceId === province.id ? 'check' : 'chevronRight'} size={15} color="#2e8b6f" />
                  </View>
                  <Text numberOfLines={2} style={styles.cardSummary}>{province.summary}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.footnote}>省份可随时在首页顶部切换，已选省份会保存在本机</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.cream },
  safe: { backgroundColor: Brand.cream },
  nav: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  back: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: Brand.ink, fontSize: 17, fontWeight: '800', letterSpacing: 0.4 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  head: { marginBottom: 18 },
  title: { color: Brand.ink, fontSize: TypeScale.title2, fontWeight: '900', letterSpacing: -0.3 },
  sub: { marginTop: 6, color: Brand.muted, fontSize: TypeScale.footnote, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  regionBlock: { marginTop: 16 },
  regionTitle: { marginBottom: 8, color: Brand.ink, fontSize: TypeScale.headline, fontWeight: '900' },
  card: { width: '48.4%', padding: 14, borderRadius: Radius.card, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  cardName: { color: Brand.ink, fontSize: TypeScale.subheadline, fontWeight: '900' },
  genericTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, overflow: 'hidden', color: Brand.muted, backgroundColor: Brand.border, fontSize: 11, fontWeight: '700' },
  cardSummary: { marginTop: 8, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 17 },
  cardSelected: { borderColor: Brand.forest, backgroundColor: Brand.forestSoft },
  footnote: { marginTop: 22, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 17, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
