import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesEntitlementInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

// 首版纯免费上线开关：false 时关闭内购订阅，所有功能直接开放，RevenueCat 不初始化。
// 后续恢复订阅时改回 true，即可恢复订阅门槛与购买流程（无需改动 _layout / index 的门槛逻辑）。
export const PREMIUM_ENABLED = false;
export const PREMIUM_ENTITLEMENT_ID = 'pro';
export const SUBSCRIPTION_PRODUCT_IDS = {
  monthly: 'com.lianerdazi.pro.monthly',
  yearly: 'com.lianerdazi.pro.yearly',
} as const;

const revenueCatIOSApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || '';
const REVENUECAT_PROXY_URL = 'https://api.rc-backup.com/';

type SubscriptionContextValue = {
  ready: boolean;
  configured: boolean;
  busy: boolean;
  isActive: boolean;
  isTrial: boolean;
  willRenew: boolean;
  expiresAt: string | null;
  offering: PurchasesOffering | null;
  error: string | null;
  refresh: () => Promise<void>;
  purchase: (item: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  manage: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function entitlementFrom(info: CustomerInfo | null): PurchasesEntitlementInfo | null {
  return info?.entitlements.active[PREMIUM_ENTITLEMENT_ID] || null;
}

function messageFrom(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const details = [
      'code' in error ? error.code : '',
      'readableErrorCode' in error ? error.readableErrorCode : '',
      'message' in error ? error.message : '',
      'underlyingErrorMessage' in error ? error.underlyingErrorMessage : '',
    ].filter((value): value is string => typeof value === 'string').join(' ');

    if (/network|offline|connection.*lost|timed?\s*out|internet/i.test(details)) {
      return '网络连接暂时中断，请点击“重新读取”获取订阅方案。';
    }
    if (/store.?problem|app store/i.test(details)) {
      return '暂时无法连接 App Store，请稍后重新读取。';
    }
    if ('message' in error && typeof error.message === 'string') return error.message;
  }
  return fallback;
}

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const configured = PREMIUM_ENABLED && Platform.OS === 'ios' && revenueCatIOSApiKey.length > 0;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyCustomerInfo = useCallback((info: CustomerInfo) => {
    setCustomerInfo(info);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!configured) {
      setError('内购服务尚未完成配置。');
      setReady(true);
      return;
    }
    setBusy(true);
    try {
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      applyCustomerInfo(info);
      setOffering(offerings.current);
      if (!offerings.current) setError('暂时没有可购买的订阅方案，请稍后再试。');
    } catch (reason) {
      setError(messageFrom(reason, '无法连接 App Store，请检查网络后重试。'));
    } finally {
      setBusy(false);
      setReady(true);
    }
  }, [applyCustomerInfo, configured]);

  useEffect(() => {
    let mounted = true;
    const listener = (info: CustomerInfo) => {
      if (mounted) applyCustomerInfo(info);
    };

    async function initialize() {
      if (!configured) {
        setReady(true);
        return;
      }
      try {
        // RevenueCat recommends its backup endpoint for users in Mainland China,
        // where the primary API may be blocked. This must run before configure().
        await Purchases.setProxyURL(REVENUECAT_PROXY_URL);
        const isConfigured = await Purchases.isConfigured();
        if (!isConfigured) {
          Purchases.configure({ apiKey: revenueCatIOSApiKey });
        }
        await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
        Purchases.addCustomerInfoUpdateListener(listener);
        await refresh();
      } catch (reason) {
        if (mounted) {
          setError(messageFrom(reason, '内购服务初始化失败，请稍后再试。'));
          setReady(true);
        }
      }
    }

    initialize();
    return () => {
      mounted = false;
      if (configured) Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo, configured, refresh]);

  const purchase = useCallback(async (item: PurchasesPackage) => {
    if (!configured) {
      setError('内购服务尚未完成配置。');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await Purchases.purchasePackage(item);
      applyCustomerInfo(result.customerInfo);
      return Boolean(entitlementFrom(result.customerInfo));
    } catch (reason) {
      const cancelled = Boolean(reason && typeof reason === 'object' && 'userCancelled' in reason && reason.userCancelled);
      if (!cancelled) setError(messageFrom(reason, '购买没有完成，请稍后再试。'));
      return false;
    } finally {
      setBusy(false);
    }
  }, [applyCustomerInfo, configured]);

  const restore = useCallback(async () => {
    if (!configured) {
      setError('内购服务尚未完成配置。');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const info = await Purchases.restorePurchases();
      applyCustomerInfo(info);
      const restored = Boolean(entitlementFrom(info));
      if (!restored) setError('当前 Apple ID 没有可恢复的有效订阅。');
      return restored;
    } catch (reason) {
      setError(messageFrom(reason, '恢复购买失败，请稍后再试。'));
      return false;
    } finally {
      setBusy(false);
    }
  }, [applyCustomerInfo, configured]);

  const manage = useCallback(async () => {
    if (!configured) return;
    try {
      await Purchases.showManageSubscriptions();
    } catch (reason) {
      setError(messageFrom(reason, '暂时无法打开 Apple 订阅管理。'));
    }
  }, [configured]);

  const entitlement = entitlementFrom(customerInfo);
  const value = useMemo<SubscriptionContextValue>(() => ({
    ready,
    configured,
    busy,
    isActive: PREMIUM_ENABLED ? Boolean(entitlement?.isActive) : true,
    isTrial: entitlement?.periodType?.toUpperCase() === 'TRIAL',
    willRenew: Boolean(entitlement?.willRenew),
    expiresAt: entitlement?.expirationDate || null,
    offering,
    error,
    refresh,
    purchase,
    restore,
    manage,
  }), [busy, configured, entitlement, error, offering, purchase, ready, refresh, restore, manage]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return value;
}
