"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { normalizeTransactions } from "@/lib/stock-flow/utils";
import type { Transaction } from "@/types/stock-flow";

type TransactionContextValue = {
  transactions: Transaction[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions");
      if (res.ok) {
        const data = await res.json();
        setTransactions(normalizeTransactions(data));
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    refresh();
  }, [refresh]);

  return (
    <TransactionContext.Provider value={{ transactions, loading, refresh }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error("useTransactions must be used within TransactionProvider");
  return ctx;
}
