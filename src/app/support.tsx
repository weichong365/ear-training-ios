import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, TypeScale } from '@/constants/theme';

const HELP = [
  ['为什么不能连续点击播放？', '每次必须完整播放结束后才能开始下一遍，避免误触浪费规定播放次数。'],
  ['什么时候可以开始写谱？', '标准音、预备拍或正题音频一开始播放，当前题目的答题区就会立即解锁。'],
  ['退出模拟考试会丢失吗？', '不会。当前试卷、答案、播放次数和题目位置会自动保存在本机，下次可继续作答。'],
  ['为什么拍号和调号一开始不显示？', '学生尚未听题并作答前，系统不会预填拍号或调号；选择后才显示在答题谱面上。'],
  ['如何删除所有数据？', '在“关于练耳搭子”页面点击“清除本机练习数据”。该操作不可恢复。'],
];

export default function SupportScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}><Text style={styles.title}>使用帮助</Text><Text style={styles.subtitle}>练耳、写谱与模拟考试常见问题</Text></View>
      {HELP.map(([title, body], index) => (
        <View key={title} style={styles.card}><View style={styles.index}><Text style={styles.indexText}>{index + 1}</Text></View><View style={styles.copy}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{body}</Text></View></View>
      ))}
      <View style={styles.contact}><Text style={styles.contactTitle}>仍然需要帮助？</Text><Text style={styles.contactBody}>请通过 App Store 产品页的“App 支持”入口联系我们，并附上设备型号、iOS 版本、题型和问题截图。</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.cream },
  content: { padding: 18, paddingBottom: 44, gap: 10 },
  hero: { padding: 22, borderRadius: Radius.hero, backgroundColor: Brand.forest },
  title: { color: Brand.textOnAccent, fontSize: TypeScale.title2, fontWeight: '900' },
  subtitle: { marginTop: 6, color: Brand.textOnAccentMuted, fontSize: TypeScale.footnote },
  card: { padding: 14, flexDirection: 'row', borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.ivory },
  index: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: Brand.forestSoft },
  indexText: { color: Brand.forest, fontSize: TypeScale.caption, fontWeight: '900' },
  copy: { flex: 1, marginLeft: 11 },
  cardTitle: { color: Brand.ink, fontSize: TypeScale.subheadline, fontWeight: '900' },
  body: { marginTop: 5, color: Brand.muted, fontSize: TypeScale.footnote, lineHeight: 20 },
  contact: { marginTop: 5, padding: 16, borderRadius: Radius.card, backgroundColor: Brand.forestSoft },
  contactTitle: { color: Brand.forest, fontSize: TypeScale.subheadline, fontWeight: '900' },
  contactBody: { marginTop: 5, color: Brand.muted, fontSize: TypeScale.footnote, lineHeight: 20 },
});
