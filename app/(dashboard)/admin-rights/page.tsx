"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, UserCheck, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPanel } from "@/components/stock-flow/DataPanel";
import { Table } from "@/components/stock-flow/Table";

type AdminUser = {
  username: string;
  isAdmin: boolean;
  createdAt: number;
};

export default function AdminRightsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Add new employee / set admin
  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    const name = newUsername.trim();
    if (!name) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, isAdmin: newIsAdmin }),
      });

      if (res.ok) {
        setNewUsername("");
        setNewIsAdmin(false);
        await fetchUsers();
        
        // Notify other parts of the application
        window.dispatchEvent(new Event("admin-users-changed"));

        // If the added user is the current simulated user, sync their role
        const currentSimUser = localStorage.getItem("simulated_username");
        if (currentSimUser === name) {
          localStorage.setItem("simulated_role", newIsAdmin ? "admin" : "employee");
          window.dispatchEvent(new Event("simulated-role-changed"));
        }
      } else {
        const err = await res.json();
        window.alert(err.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } catch (error) {
      console.error("Failed to add user", error);
      window.alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Toggle Admin status
  async function handleToggleAdmin(username: string, currentStatus: boolean) {
    if (username === "แอดมิน") {
      window.alert("ไม่สามารถปิดการใช้งานสิทธิ์ของ แอดมิน หลักได้");
      return;
    }

    const nextStatus = !currentStatus;
    
    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.username === username ? { ...u, isAdmin: nextStatus } : u))
    );

    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, isAdmin: nextStatus }),
      });

      if (res.ok) {
        // Notify other parts of the application
        window.dispatchEvent(new Event("admin-users-changed"));

        // If toggling active simulated user, sync their role
        const currentSimUser = localStorage.getItem("simulated_username");
        if (currentSimUser === username) {
          localStorage.setItem("simulated_role", nextStatus ? "admin" : "employee");
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
              แต่งตั้งหรือถอนสิทธิ์แอดมินให้กับพนักงานในระบบเพื่ออนุมัติหรือจัดการใบเบิกสินค้า
            </p>
          </div>
        </div>
      </section>

      {/* Main Grid Content */}
      <div className="grid gap-3 lg:grid-cols-5">
        {/* Left Column: Form to Add/Set user */}
        <div className="lg:col-span-2">
          <DataPanel
            title="เพิ่มสิทธิ์พนักงาน"
            description="ลงทะเบียนพนักงานใหม่หรือกำหนดสิทธิ์แอดมินให้กับพนักงานที่มีอยู่แล้ว"
          >
            <form onSubmit={handleAddUser} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[var(--text-strong)]">ชื่อพนักงาน *</span>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย, วิชัย"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="control-input w-full"
                  disabled={isSubmitting}
                />
              </label>

              <div className="flex items-center space-x-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <input
                  id="newIsAdmin"
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  disabled={isSubmitting}
                />
                <label htmlFor="newIsAdmin" className="cursor-pointer select-none">
                  <span className="block text-xs font-semibold text-[var(--text-strong)]">
                    แต่งตั้งเป็นแอดมิน (Admin Status)
                  </span>
                  <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
                    ให้สิทธิ์สามารถอนุมัติใบเบิก จ่ายสินค้า และจัดการสิทธิ์อื่น ๆ
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || !newUsername.trim()}
                  className="w-full justify-center bg-sky-600 text-white hover:bg-sky-500"
                >
                  {isSubmitting ? (
                    "กำลังบันทึก..."
                  ) : (
                    <>
                      <Plus size={16} className="mr-1" />
                      บันทึกสิทธิ์พนักงาน
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DataPanel>
        </div>

        {/* Right Column: List of all users */}
        <div className="lg:col-span-3">
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
                headers={["ชื่อพนักงาน", "บทบาท (Role)", "วันที่จัดการ", "สิทธิ์แอดมิน"]}
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
                      {user.isAdmin ? (
                        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/10">
                          <Shield size={12} className="mr-1" />
                          แอดมิน (Admin)
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
                      <button
                        type="button"
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                          user.isAdmin ? "bg-sky-600" : "bg-slate-200"
                        } ${user.username === "แอดมิน" ? "opacity-50 cursor-not-allowed" : ""}`}
                        onClick={() => handleToggleAdmin(user.username, user.isAdmin)}
                        disabled={user.username === "แอดมิน"}
                        aria-label={`สลับสิทธิ์แอดมินของ ${user.username}`}
                        title={user.username === "แอดมิน" ? "แอดมินหลักไม่สามารถปิดสิทธิ์ได้" : "คลิกเพื่อสลับสิทธิ์"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            user.isAdmin ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </DataPanel>
        </div>
      </div>
    </section>
  );
}
