import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ProvinceId } from '@/core/provinces';
import { getSelectedProvince, saveSelectedProvince } from '@/services/local-data';

type ProvinceContextValue = {
  ready: boolean;
  provinceId: ProvinceId | null;
  setProvince: (id: ProvinceId) => Promise<void>;
};

const ProvinceContext = createContext<ProvinceContextValue>({
  ready: false,
  provinceId: null,
  setProvince: async () => undefined,
});

export function ProvinceProvider({ children }: { children: ReactNode }) {
  const [provinceId, setProvinceId] = useState<ProvinceId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSelectedProvince()
      .then((value) => {
        if (!mounted) return;
        setProvinceId(value);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setReady(true);
      });
    return () => { mounted = false; };
  }, []);

  const setProvince = useMemo(() => async (id: ProvinceId) => {
    setProvinceId(id);
    await saveSelectedProvince(id);
  }, []);

  return (
    <ProvinceContext.Provider value={{ ready, provinceId, setProvince }}>
      {children}
    </ProvinceContext.Provider>
  );
}

export function useProvince() {
  return useContext(ProvinceContext);
}
