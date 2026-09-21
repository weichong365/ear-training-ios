import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Btn, hitSlopVertical } from '@/constants/button-tokens';
import { Brand, Radius, TypeScale } from '@/constants/theme';
import { clearLocalPracticeData } from '@/services/local-data';

const PRIVACY_ROUTE = '/privacy' as Href;
const SUPPORT_ROUTE = '/support' as Href;

const ITEMS = [
  { title: '专业听记流程', body: '标准音、预备拍与正题音频连续播放；完整播放结束后才可重听。' },
  { title: '离线钢琴音色', body: '题目与复盘钢琴统一使用 G3–A5 共 27 个独立定音采样。' },
  { title: '本地优先', body: '首版不要求登录，练习记录和错题优先保存在当前设备。' },
];

export default function AboutScreen() {
  const version = Constants.expoConfig?.version || '1.0.0';
  function clearData() {
    Alert.alert('清除本机练习数据', '此操作会删除练习记录、错题、未完成试卷和考试成绩，且无法恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '确认清除', style: 'destructive', onPress: async () => {
        await clearLocalPracticeData();
        Alert.alert('已清除', '练习记录、错题和模拟考试数据已从本机删除。');
      } },
    ]);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.brandCard}>
        <View style={styles.mark}><AppIcon name="melody" size={38} color={Brand.textOnAccent} /></View>
        <Text style={styles.name}>练耳搭子</Text>
        <Text style={styles.desc}>音乐艺考 · 视唱练耳专项训练</Text>
        <Text style={styles.version}>iOS {version}</Text>
      </View>

      <Text style={styles.sectionLabel}>产品原则</Text>
      {ITEMS.map((item, index) => (
        <View key={item.title} style={styles.item}>
          <View style={styles.itemIndex}><Text style={styles.itemIndexText}>{index + 1}</Text></View>
          <View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemBody}>{item.body}</Text></View>
        </View>
      ))}

      <Text style={styles.sectionLabel}>隐私与数据</Text>
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>首版最小化收集数据</Text>
        <Text style={styles.privacyBody}>当前 iOS 工程不接入广告、追踪 SDK 或微信登录，练习记录、错题和模拟考试进度默认保存在本机。</Text>
        <View style={styles.linkRow}>
          <Pressable accessibilityRole="link" hitSlop={hitSlopVertical(Btn.about.inviteButton.height)} onPress={() => router.push(PRIVACY_ROUTE)} style={styles.linkButton}><Text style={styles.linkText}>隐私政策</Text></Pressable>
          <Pressable accessibilityRole="link" hitSlop={hitSlopVertical(Btn.about.inviteButton.height)} onPress={() => router.push(SUPPORT_ROUTE)} style={styles.linkButton}><Text style={styles.linkText}>使用帮助</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" hitSlop={hitSlopVertical(Btn.about.inviteButton.height)} onPress={clearData} style={styles.clearButton}><Text style={styles.clearText}>清除本机练习数据</Text></Pressable>
      </View>

      <View style={styles.copyright}>
        <Text style={styles.copyrightText}>钢琴采样：bitKlavier Grand（new Steinway D）</Text>
        <Text style={styles.copyrightText}>Dan Trueman 制作 · Princeton University 录制</Text>
        <Text style={styles.copyrightText}>许可 CC BY 4.0 · creativecommons.org/licenses/by/4.0</Text>
        <Text style={styles.copyrightText}>来源 bitklavier.com/the-bitklavier-grand</Text>
        <Text style={styles.copyrightText}>本项目做了裁切、单声道、音高校准与响度归一</Text>
        <Text style={styles.copyrightText}>© 2026 练耳搭子</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // 状态栏下沿的分隔线：ScrollView 顶边正好落在 sceneStyle 的 paddingTop（= insets.top）处，
  // 所以加 borderTop 就等于把线贴在状态栏下方，与底部 tabBar 上沿同一条（Brand.hairline）。
  page: { flex: 1, backgroundColor: Brand.cream, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.hairline },
  content: { padding: 18, paddingBottom: 45, gap: 12 },
  brandCard: { padding: 27, alignItems: 'center', borderRadius: Radius.hero, backgroundColor: Brand.forestDeep },
  mark: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.hero, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', backgroundColor: 'rgba(255,255,255,.10)' },
  name: { marginTop: 16, color: Brand.textOnAccent, fontSize: TypeScale.title1, fontWeight: '900' },
  desc: { marginTop: 5, color: Brand.textOnAccentMuted, fontSize: TypeScale.footnote },
  version: { marginTop: 13, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, overflow: 'hidden', color: Brand.textOnAccentMuted, backgroundColor: 'rgba(255,255,255,.09)', fontSize: TypeScale.caption },
  sectionLabel: { marginTop: 7, paddingHorizontal: 3, color: Brand.muted, fontSize: TypeScale.footnote, fontWeight: '800' },
  item: { padding: 14, flexDirection: 'row', borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.ivory },
  itemIndex: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: Brand.forestSoft },
  itemIndexText: { color: Brand.forest, fontSize: 12, fontWeight: '900' },
  itemCopy: { flex: 1, marginLeft: 12 },
  itemTitle: { color: Brand.ink, fontSize: TypeScale.subheadline, fontWeight: '900' },
  itemBody: { marginTop: 5, color: Brand.muted, fontSize: TypeScale.footnote, lineHeight: 20 },
  privacyCard: { padding: 16, borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.ivory },
  privacyTitle: { color: Brand.ink, fontSize: TypeScale.headline, fontWeight: '900' },
  privacyBody: { marginTop: 7, color: Brand.muted, fontSize: TypeScale.footnote, lineHeight: 20 },
  linkRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  linkButton: { flex: 1, ...Btn.about.inviteButton, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.forestSoft },
  linkText: { color: Brand.forest, fontSize: Btn.about.inviteButton.fontSize, fontWeight: '800' },
  clearButton: { ...Btn.about.inviteButton, marginTop: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.dangerSoft },
  clearText: { color: Brand.danger, fontSize: Btn.about.inviteButton.fontSize, fontWeight: '800' },
  copyright: { marginTop: 12, alignItems: 'center', gap: 5 },
  copyrightText: { color: Brand.muted, fontSize: TypeScale.caption },
});
