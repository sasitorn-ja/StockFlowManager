"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, UserCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";

type AdminUser = {
  username: string;
  isAdmin: boolean;
  role: "employee" | "manager" | "admin";
  createdAt: number;
};

export default function AdminRightsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [simulatedRole, setSimulatedRole] = useState("employee");

  // Load current simulated role
  useEffect(() => {
    const role = localStorage.getItem("simulated_role") || "employee";
    setSimulatedRole(role);

    // Listen to changes from layout
    const handleRoleChangedExternal = () => {
      setSimulatedRole(localStorage.getItem("simulated_role") || "employee");
    };

    window.addEventListener("simulated-role-changed", handleRoleChangedExternal);
    return () => {
      window.removeEventListener("simulated-role-changed", handleRoleChangedExternal);
    };
  }, []);

  // Fetch all users
  async function fetchUsers() {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin-users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch admin users", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  // Toggle Admin status
  async function handleUpdateRole(username: string, nextRole: AdminUser["role"]) {
    if (username === "แอดมิน") {
      window.alert("ไม่สามารถปรับบทบาทของแอดมินหลักได้");
      return;
    }
    
    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) =>
        u.username === username ? { ...u, role: nextRole, isAdmin: nextRole === "admin" } : u
      )
    );

    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role: nextRole }),
      });

      if (res.ok) {
        // Notify other parts of the application
        window.dispatchEvent(new Event("admin-users-changed"));

        // If toggling active simulated user, sync their role
        const currentSimUser = localStorage.getItem("simulated_username");
        if (currentSimUser === username) {
          localStorage.setItem("simulated_role", nextRole);
          window.dispatchEvent(new Event("simulated-role-changed"));
        }
      } else {
        // Revert on error
        await fetchUsers();
        window.alert("ไม่สามารถปรับปรุงสิทธิ์ได้");
      }
    } catch (error) {
      console.error("Failed to toggle admin status", error);
      await fetchUsers();
      window.alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  }

  // Format timestamp to localized date string
  function formatTimestamp(timestamp: number) {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Access control check
  if (simulatedRole !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="dashboard-card max-w-[480px] p-8 text-center shadow-xl backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <ShieldAlert size={30} />
          </div>
          <h3 className="mt-6 text-lg font-bold text-[var(--text-strong)]">ปฏิเสธการเข้าถึง</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            ขออภัย คุณไม่มีสิทธิ์เข้าถึงหน้านี้ เฉพาะผู้ใช้งานระดับ **แอดมิน** เท่านั้นที่ได้รับสิทธิ์ให้จัดการข้อมูลในส่วนนี้
          </p>
          <div className="mt-6">
            <Button onClick={() => router.push("/overview")} className="bg-sky-600 text-white hover:bg-sky-5050">
              กลับสู่หน้าหลัก
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section id="admin-rights" className="grid gap-3">
      {/* Page Title Card */}
      <section className="dashboard-card">
        <div className="dashboard-panel-header">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600">
              Security &amp; Access Control
            </p>
            <h3 className="dashboard-section-title">จัดการสิทธิ์แอดมิน</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              กำหนดบทบาทพนักงาน โดยมีสิทธิ์ระดับผู้จัดการและแอดมินรวมกันได้สูงสุด 2 คน
            </p>
          </div>
        </div>
      </section>

      <DataPanel
        title="รายชื่อและสิทธิ์พนักงานทั้งหมด"
        description="รายชื่อพนักงานทั้งหมดที่อยู่ในฐานข้อมูลรวมกับผู้ที่มีประวัติทำธุรกรรมในระบบ"
      >
        {isLoading ? (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">
            กำลังโหลดข้อมูลพนักงาน...
          </div>
        ) : (
          <Table
            headers={["ชื่อพนักงาน", "บทบาท (Role)", "วันที่จัดการ", "ปรับบทบาท"]}
            columnCount={4}
            emptyMessage="ยังไม่มีข้อมูลพนักงาน"
          >
            {users.map((user) => (
              <tr key={`user-row-${user.username}`}>
                <td>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-[var(--text-strong)]">
                      {user.username}
                    </span>
                  </div>
                </td>
                <td>
                  {user.role === "admin" ? (
                    <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/10">
                      <Shield size={12} className="mr-1" />
                      แอดมิน (Admin)
                    </span>
                  ) : user.role === "manager" ? (
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/10">
                      <UserCheck size={12} className="mr-1" />
                      ผู้จัดการ (Manager)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                      พนักงาน (Employee)
                    </span>
                  )}
                </td>
                <td className="text-xs text-[var(--text-muted)]">
                  {formatTimestamp(user.createdAt)}
                </td>
                <td>
                  <select
                    value={user.role}
                    onChange={(event) =>
                      handleUpdateRole(user.username, event.target.value as AdminUser["role"])
                    }
                    disabled={user.username === "แอดมิน"}
                    className="control-input w-full min-w-[140px]"
                    title={user.username === "แอดมิน" ? "แอดมินหลักไม่สามารถปรับบทบาทได้" : "ปรับบทบาทผู้ใช้"}
                  >
                    <option value="employee">พนักงาน</option>
                    <option value="manager">ผู้จัดการ</option>
                    <option value="admin">แอดมิน</option>
                  </select>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </DataPanel>
    </section>
  );
}
