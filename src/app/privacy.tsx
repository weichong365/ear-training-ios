import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, TypeScale } from '@/constants/theme';

const SECTIONS = [
  ['我们处理的数据', '练习题型、答题结果、正确率、错题记录、模拟考试进度和用户主动调整的设置默认保存在当前设备。当前版本不接入广告、跨应用追踪、微信登录或第三方广告分析 SDK。'],
  ['订阅与购买', '订阅交易由 Apple App Store 完成。为验证订阅状态、恢复购买和避免重复收费，我们使用 RevenueCat 处理匿名 App 用户标识、商品标识、交易状态、订阅期限和必要的收据验证结果。我们不会收到完整银行卡号或 Apple ID 密码。'],
  ['设备权限', 'App 仅播放内置练耳音频，不需要麦克风、通讯录、精确位置、相册或摄像头权限。'],
  ['数据控制', '用户可以在“关于练耳搭子”中清除本机数据。卸载 App 也会删除仅保存在 App 沙盒内的练习数据。'],
  ['未成年人', 'App 面向音乐学习者。未成年人应在监护人指导下使用；当前版本不会主动要求用户填写年龄或个人身份资料。'],
  ['政策更新', '若未来新增账号、云同步或崩溃分析，我们会在启用前说明用途，并同步更新本政策和 App Store 隐私标签。'],
];

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}><Text style={styles.title}>练耳搭子隐私政策</Text><Text style={styles.date}>更新日期：2026 年 8 月 28 日</Text></View>
      <Text style={styles.intro}>我们坚持本地优先和最小化收集原则。首个 iOS 版本无需注册或登录即可使用核心练耳功能。</Text>
      {SECTIONS.map(([title, body]) => <View key={title} style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{body}</Text></View>)}
      <Text style={styles.note}>RevenueCat 仅用于订阅管理，不用于广告追踪。本政策会同步发布于 App Store 产品页所列的隐私政策网址；如有更新，将在新版本中说明。</Text>
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
  note: { padding: 8, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
});
