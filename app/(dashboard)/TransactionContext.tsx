"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { withBasePath } from "@/lib/base-path";
import { normalizeTransactions } from "@/lib/stock-flow/utils";
import type { Transaction } from "@/types/stock-flow";

type TransactionContextValue = {
  transactions: Transaction[];
  loading: boolean;
  refresh: () => Promise<void>;
  patchIssueStatus: (issueKey: string, nextStatus: Transaction["status"], updates?: Partial<Pick<Transaction, "approver">>) => void;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(withBasePath("/api/transactions"), { cache: "no-store" });
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

  const patchIssueStatus = useCallback(
    (issueKey: string, nextStatus: Transaction["status"], updates?: Partial<Pick<Transaction, "approver">>) => {
      setTransactions((current) =>
        current.map((transaction) =>
          transaction.issueKey === issueKey
            ? {
                ...transaction,
                status: nextStatus,
                approver: updates?.approver ?? transaction.approver,
              }
            : transaction
        )
      );
    },
    []
  );

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    refresh();
  }, [refresh]);

  return (
    <TransactionContext.Provider value={{ transactions, loading, refresh, patchIssueStatus }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error("useTransactions must be used within TransactionProvider");
  return ctx;
}
