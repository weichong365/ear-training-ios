import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, TouchTarget, TypeScale } from '@/constants/theme';

const SECTIONS = [
  ['一、服务内容', '练耳搭子提供单音、音程、和弦、节奏、旋律听辨，全国各省真题框架模拟考试，以及错题与练习统计等数字内容服务。'],
  ['二、免费试用', '符合 Apple 条件的新订阅用户可享受 App Store Connect 所显示期限的免费试用。开始试用时即建立自动续订订阅，但在免费期结束前不会收费。每个订阅组的试用资格由 Apple 判定。'],
  ['三、自动续订与扣款', '试用或当前订阅期结束前至少 24 小时，如未取消，Apple 将按购买页面显示的价格和周期自动续订，并从你的 Apple ID 付款账户扣款。实际价格、币种和税费以购买确认页为准。'],
  ['四、取消与管理', '你可以随时在 iPhone“设置—Apple ID—订阅”或本 App 的“管理 Apple 订阅”入口关闭自动续订。取消后，在当前试用或已付费周期结束前仍可使用全部功能。'],
  ['五、恢复购买与退款', '更换设备或重新安装后，可使用“恢复购买”找回同一 Apple ID 下的有效订阅。订单、扣款和退款由 Apple 处理；退款申请须通过 Apple 的官方渠道提交。'],
  ['六、合理使用', '题目、谱例、音频与页面设计仅供个人学习使用。不得批量复制、转售、抓取或以其他方式传播 App 内受保护内容。'],
  ['七、服务调整', '我们会持续改进题库和功能。如订阅权益发生实质变化，将通过版本说明或 App 内页面提前告知，并遵守 Apple 的订阅与价格变更规则。'],
];

export default function TermsScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}><Text style={styles.title}>订阅与使用条款</Text><Text style={styles.date}>更新日期：2026 年 8 月 28 日</Text></View>
      <Text style={styles.intro}>开始免费试用或确认订阅前，请阅读以下条款。Apple 的购买确认页会再次显示准确的试用期限、价格和续订周期。</Text>
      {SECTIONS.map(([title, body]) => <View key={title} style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{body}</Text></View>)}
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')} style={styles.appleLink}>
        <Text style={styles.appleLinkText}>查看 Apple 标准最终用户许可协议</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.cream },
  content: { padding: 18, paddingBottom: 44, gap: 11 },
  hero: { padding: 22, borderRadius: Radius.hero, backgroundColor: Brand.forestDeep },
  title: { color: Brand.textOnAccent, fontSize: TypeScale.title2, fontWeight: '900' },
  date: { marginTop: 8, color: Brand.textOnAccentMuted, fontSize: TypeScale.caption },
  intro: { padding: 15, color: Brand.ink, fontSize: TypeScale.footnote, lineHeight: 20, borderRadius: Radius.card, backgroundColor: Brand.forestSoft },
  card: { padding: 15, borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.ivory },
  cardTitle: { color: Brand.ink, fontSize: TypeScale.subheadline, fontWeight: '900' },
  body: { marginTop: 6, color: Brand.muted, fontSize: TypeScale.footnote, lineHeight: 20 },
  appleLink: { minHeight: TouchTarget, alignItems: 'center', justifyContent: 'center' },
  appleLinkText: { color: Brand.forest, fontSize: TypeScale.footnote, fontWeight: '800', textDecorationLine: 'underline' },
});
