import {
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  XCircle
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Role = "super_admin" | "admin" | "member";
type ApplicationStatus = "pending" | "approved" | "rejected";

interface Actor {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  permissions: string[];
}

interface Material {
  id: string;
  name: string;
  spec: string;
  stock: number;
  warnStock: number;
  unit: string;
  location: string;
  manager: string;
}

interface InventoryApplication {
  id: string;
  materialId: string;
  materialName: string;
  applicantId: string;
  applicantName: string;
  quantity: number;
  reason: string;
  status: ApplicationStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewRemark?: string;
}

interface Summary {
  materialCount: number;
  lowStockCount: number;
  pendingApplications: number;
  approvedApplications: number;
}

interface ManagedUser {
  id: string;
  username: string;
  studentId?: string;
  phone?: string;
  displayName: string;
  role: Role;
  identityProvider: string;
  active: boolean;
  createdAt: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const applicationPreviewLimit = 8;
const accountPreviewLimit = 10;
const defaultResetPassword = "Student@123456";

function statusText(status: ApplicationStatus) {
  return {
    pending: "待审批",
    approved: "已批准",
    rejected: "已拒绝"
  }[status];
}

function roleText(role: Role) {
  return {
    super_admin: "超级管理员",
    admin: "管理员",
    member: "成员"
  }[role];
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("lab_token") ?? "");
  const [actor, setActor] = useState<Actor | null>(() => {
    const raw = sessionStorage.getItem("lab_actor");
    return raw ? (JSON.parse(raw) as Actor) : null;
  });
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin@123456");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [applications, setApplications] = useState<InventoryApplication[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [profile, setProfile] = useState<ManagedUser | null>(null);
  const [summary, setSummary] = useState<Summary>({
    materialCount: 0,
    lowStockCount: 0,
    pendingApplications: 0,
    approvedApplications: 0
  });
  const [selectedMaterialId, setSelectedMaterialId] = useState("m-001");
  const [quantity, setQuantity] = useState(1);
  const [stockInQuantity, setStockInQuantity] = useState(5);
  const [reason, setReason] = useState("课题实验耗材申请");
  const [message, setMessage] = useState("请登录后开始使用。");
  const [loading, setLoading] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("student002");
  const [registerPassword, setRegisterPassword] = useState("Student@123456");
  const [registerStudentId, setRegisterStudentId] = useState("S000002");
  const [registerDisplayName, setRegisterDisplayName] = useState("学生二号");
  const [registerRole, setRegisterRole] = useState<"admin" | "member">("member");
  const [accountTab, setAccountTab] = useState<"profile" | "security" | "list" | "register">(
    "profile"
  );
  const [userSearch, setUserSearch] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showAllApplications, setShowAllApplications] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);

  const canApprove = actor?.permissions.includes("inventory:write") ?? false;
  const canManageUsers = actor?.permissions.includes("user:write") ?? false;

  function headers(activeToken = token) {
    return {
      Authorization: `Bearer ${activeToken}`,
      "Content-Type": "application/json"
    };
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "登录失败");
      }

      setToken(payload.token);
      setActor(payload.actor);
      sessionStorage.setItem("lab_token", payload.token);
      sessionStorage.setItem("lab_actor", JSON.stringify(payload.actor));
      setMessage(`欢迎回来，${payload.actor.displayName}`);
      await loadData(payload.token);
      await loadProfile(payload.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken("");
    setActor(null);
    sessionStorage.removeItem("lab_token");
    sessionStorage.removeItem("lab_actor");
    setMessage("已退出登录。");
  }

  async function loadData(activeToken = token) {
    if (!activeToken) {
      return;
    }

    const [summaryResponse, materialsResponse, applicationsResponse] = await Promise.all([
      fetch(`${apiBase}/inventory/summary`, { headers: headers(activeToken) }),
      fetch(`${apiBase}/inventory/materials`, { headers: headers(activeToken) }),
      fetch(`${apiBase}/inventory/applications`, { headers: headers(activeToken) })
    ]);

    if (!summaryResponse.ok || !materialsResponse.ok || !applicationsResponse.ok) {
      throw new Error("数据加载失败，请确认 API 容器正在运行或重新登录。");
    }

    setSummary(await summaryResponse.json());
    setMaterials(await materialsResponse.json());
    setApplications(await applicationsResponse.json());
  }

  async function loadUsers(search = userSearch, activeToken = token) {
    if (!activeToken || !canManageUsers) {
      return;
    }

    const response = await fetch(`${apiBase}/auth/users?search=${encodeURIComponent(search)}`, {
      headers: headers(activeToken)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "账号列表加载失败");
    }
    setUsers(payload);
  }

  async function loadProfile(activeToken = token) {
    if (!activeToken) {
      return;
    }

    const response = await fetch(`${apiBase}/auth/profile`, {
      headers: headers(activeToken)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "个人资料加载失败");
    }
    setProfile(payload);
    setContactPhone(payload.phone ?? "");
  }

  useEffect(() => {
    loadData().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "系统连接失败");
    });
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const refresh = () => {
      loadData(token).catch(() => {
        // Background refresh should not interrupt the user's current workflow.
      });
      loadProfile(token).catch(() => {
        // Profile refresh is best-effort for background updates.
      });
    };
    refresh();
    const eventSource = new EventSource(`${apiBase}/events?token=${encodeURIComponent(token)}`);
    eventSource.addEventListener("domain-event", refresh);
    const intervalId = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      eventSource.close();
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [token]);

  useEffect(() => {
    if (!canManageUsers) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowAllAccounts(false);
      loadUsers().catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "账号列表加载失败");
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [canManageUsers, userSearch, token]);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === selectedMaterialId),
    [materials, selectedMaterialId]
  );

  const pendingApplications = applications.filter(
    (application) => application.status === "pending"
  );
  const visibleApplications = canApprove
    ? applications
    : applications.filter((application) => application.applicantId === actor?.id);
  const displayedApplications = showAllApplications
    ? visibleApplications
    : visibleApplications.slice(0, applicationPreviewLimit);
  const hasMoreApplications = visibleApplications.length > applicationPreviewLimit;
  const displayedUsers = showAllAccounts ? users : users.slice(0, accountPreviewLimit);
  const hasMoreUsers = users.length > accountPreviewLimit;

  async function submitApplication(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/inventory/applications`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          materialId: selectedMaterialId,
          quantity,
          reason
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "申请提交失败");
      }

      setMessage(`申请已提交：${payload.materialName} x ${payload.quantity}`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "申请提交失败");
    } finally {
      setLoading(false);
    }
  }

  async function stockInMaterial() {
    setLoading(true);
    try {
      const response = await fetch(
        `${apiBase}/inventory/materials/${selectedMaterialId}/stock-in`,
        {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({
            quantity: stockInQuantity,
            remark: "管理员入库登记"
          })
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "入库失败");
      }
      setMessage(`${payload.name} 已入库 ${stockInQuantity}${payload.unit}`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "入库失败");
    } finally {
      setLoading(false);
    }
  }

  async function reviewApplication(id: string, action: "approve" | "reject") {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/inventory/applications/${id}/${action}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          remark: action === "approve" ? "库存确认无误，批准领用。" : "请补充实验说明后重新提交。"
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "审批失败");
      }
      setApplications((current) =>
        current.map((application) => (application.id === id ? payload : application))
      );
      setSummary((current) => ({
        ...current,
        pendingApplications: Math.max(0, current.pendingApplications - 1),
        approvedApplications:
          action === "approve" ? current.approvedApplications + 1 : current.approvedApplications
      }));
      if (action === "approve") {
        setMaterials((current) =>
          current.map((material) =>
            material.id === payload.materialId
              ? { ...material, stock: material.stock - payload.quantity }
              : material
          )
        );
      }
      setMessage(action === "approve" ? "已批准申请并扣减库存。" : "已拒绝申请。");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审批失败");
    } finally {
      setLoading(false);
    }
  }

  async function registerUser(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          username: registerUsername,
          password: registerPassword,
          studentId: registerStudentId,
          displayName: registerDisplayName,
          role: registerRole
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "注册失败");
      }

      setMessage(`已创建账号：${payload.displayName} / ${payload.username}`);
      setRegisterUsername("");
      setRegisterPassword("");
      setRegisterStudentId("");
      setRegisterDisplayName("");
      setRegisterRole("member");
      setAccountTab("list");
      await loadUsers("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  async function updateContact(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/auth/profile/contact`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ phone: contactPhone })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "手机号更新失败");
      }
      setProfile(payload);
      setContactPhone(payload.phone ?? "");
      setMessage("绑定手机已更新。");
      if (canManageUsers) {
        await loadUsers();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "手机号更新失败");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("两次输入的新密码不一致。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/auth/profile/password`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "密码修改失败");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("密码已修改，下次登录请使用新密码。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "密码修改失败");
    } finally {
      setLoading(false);
    }
  }

  async function resetUserPassword(user: ManagedUser) {
    const confirmed = window.confirm(
      `确认将 ${user.displayName} 的密码重置为 ${defaultResetPassword}？`
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/auth/users/${user.id}/password`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ newPassword: defaultResetPassword })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "重置密码失败");
      }
      setMessage(`已重置 ${user.displayName} 的密码。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重置密码失败");
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(user: ManagedUser) {
    const confirmed = window.confirm(`确认删除学员 ${user.displayName}？该账号将无法登录。`);
    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/auth/users/${user.id}`, {
        method: "DELETE",
        headers: headers()
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "删除学员失败");
      }
      setMessage(`已删除学员：${user.displayName}`);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除学员失败");
    } finally {
      setLoading(false);
    }
  }

  if (!actor) {
    return (
      <main className="login-shell">
        <form className="login-panel" onSubmit={login}>
          <div className="brand login-brand">
            <FlaskConical size={30} />
            <div>
              <strong>实验室管理平台</strong>
              <span>Lab Ops Console</span>
            </div>
          </div>
          <h1>登录工作台</h1>
          <p>可使用账号、学号/工号或手机号登录。默认账号：admin / Admin@123456。</p>
          <label>
            账号 / 学号 / 手机号
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primary" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
          <span className="login-message">{message}</span>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FlaskConical size={26} />
          <div>
            <strong>实验室管理平台</strong>
            <span>Lab Ops Console</span>
          </div>
        </div>

        <nav className="nav">
          <a className="active" href="#dashboard">
            <LayoutDashboard size={18} />
            工作台
          </a>
          <a href="#inventory">
            <Boxes size={18} />
            耗材设备
          </a>
          <a href="#applications">
            <ClipboardList size={18} />
            申请审批
          </a>
          <a href="#files">
            <FileText size={18} />
            文件资料
          </a>
          <a href="#members">
            <Users size={18} />
            账户管理
          </a>
        </nav>

        <div className="role-card">
          <span>当前用户</span>
          <strong>{actor.displayName}</strong>
          <small>
            {actor.username} · {roleText(actor.role)}
          </small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">今日实验室运营</p>
            <h1>耗材申请与审批工作台</h1>
          </div>
          <div className="top-actions">
            <span className="notice">
              <Bell size={17} />
              {message}
            </span>
            <button className="ghost" onClick={logout}>
              <LogOut size={17} />
              退出
            </button>
          </div>
        </header>

        <section id="dashboard" className="metrics">
          <Metric icon={<Database />} label="耗材种类" value={summary.materialCount} />
          <Metric
            icon={<ShieldCheck />}
            label="低库存预警"
            value={summary.lowStockCount}
            tone="warning"
          />
          <Metric icon={<ClipboardList />} label="待审批申请" value={summary.pendingApplications} />
          <Metric icon={<PackageCheck />} label="已批准申请" value={summary.approvedApplications} />
        </section>

        <section className="layout">
          <div className="panel inventory-panel" id="inventory">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Inventory</p>
                <h2>耗材库存</h2>
              </div>
              <span>{materials.length} 项</span>
            </div>

            <div className="material-list">
              {materials.map((material) => (
                <button
                  className={`material-row ${selectedMaterialId === material.id ? "picked" : ""}`}
                  key={material.id}
                  onClick={() => setSelectedMaterialId(material.id)}
                >
                  <div>
                    <strong>{material.name}</strong>
                    <span>{material.spec}</span>
                  </div>
                  <div className="stock">
                    <b className={material.stock <= material.warnStock ? "danger" : ""}>
                      {material.stock}
                    </b>
                    <span>{material.unit}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form className="panel request-panel" onSubmit={submitApplication}>
            <div className="panel-head">
              <div>
                <p className="eyebrow">Request</p>
                <h2>{canApprove ? "入库与申请" : "提交领用申请"}</h2>
              </div>
              <Send size={20} />
            </div>

            <label>
              申请耗材
              <select
                value={selectedMaterialId}
                onChange={(event) => setSelectedMaterialId(event.target.value)}
              >
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name} / 库存 {material.stock}
                    {material.unit}
                  </option>
                ))}
              </select>
            </label>

            <label>
              数量
              <input
                min={1}
                max={selectedMaterial?.stock ?? 99}
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </label>

            <label>
              用途说明
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>

            <div className="selected-material">
              <span>存放位置</span>
              <strong>{selectedMaterial?.location ?? "-"}</strong>
              <span>负责人</span>
              <strong>{selectedMaterial?.manager ?? "-"}</strong>
            </div>

            <button className="primary" disabled={loading}>
              {loading ? "处理中..." : "提交申请"}
            </button>

            {canApprove ? (
              <div className="stock-in">
                <label>
                  入库数量
                  <input
                    min={1}
                    type="number"
                    value={stockInQuantity}
                    onChange={(event) => setStockInQuantity(Number(event.target.value))}
                  />
                </label>
                <button type="button" className="ghost full" onClick={stockInMaterial}>
                  登记入库
                </button>
              </div>
            ) : null}
          </form>
        </section>

        <section className="panel" id="applications">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Approval</p>
              <h2>{canApprove ? "审批队列" : "我的申请记录"}</h2>
            </div>
            <span>{canApprove ? pendingApplications.length : visibleApplications.length} 条</span>
          </div>

          <div className={`table list-frame ${showAllApplications ? "expanded" : ""}`}>
            <div className="table-head">
              <span>耗材</span>
              <span>申请人</span>
              <span>数量</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            {displayedApplications.map((application) => (
              <div className="table-row" key={application.id}>
                <span>
                  <strong>{application.materialName}</strong>
                  <small>{application.reason}</small>
                </span>
                <span>{application.applicantName}</span>
                <span>{application.quantity}</span>
                <span>
                  <b className={`pill ${application.status}`}>{statusText(application.status)}</b>
                </span>
                <span className="row-actions">
                  {canApprove && application.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => reviewApplication(application.id, "approve")}
                      >
                        <CheckCircle2 size={16} />
                        批准
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => reviewApplication(application.id, "reject")}
                      >
                        <XCircle size={16} />
                        拒绝
                      </button>
                    </>
                  ) : (
                    <small>{application.reviewRemark ?? "等待处理"}</small>
                  )}
                </span>
              </div>
            ))}
          </div>
          {hasMoreApplications ? (
            <button
              className="ghost more-button"
              type="button"
              onClick={() => setShowAllApplications((value) => !value)}
            >
              {showAllApplications
                ? "收起"
                : `展示更多（还有 ${visibleApplications.length - applicationPreviewLimit} 条）`}
            </button>
          ) : null}
        </section>

        <section className="panel member-panel" id="members">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Members</p>
              <h2>账户管理</h2>
            </div>
            <Users size={20} />
          </div>

          <div className="subnav">
            <button
              type="button"
              className={accountTab === "profile" ? "selected" : ""}
              onClick={() => setAccountTab("profile")}
            >
              个人资料
            </button>
            <button
              type="button"
              className={accountTab === "security" ? "selected" : ""}
              onClick={() => setAccountTab("security")}
            >
              修改密码
            </button>
            {canManageUsers ? (
              <>
                <button
                  type="button"
                  className={accountTab === "list" ? "selected" : ""}
                  onClick={() => setAccountTab("list")}
                >
                  账号列表
                </button>
                <button
                  type="button"
                  className={accountTab === "register" ? "selected" : ""}
                  onClick={() => setAccountTab("register")}
                >
                  注册账号
                </button>
              </>
            ) : null}
          </div>

          {accountTab === "profile" ? (
            <div className="profile-grid">
              <article className="profile-card">
                <Users size={22} />
                <span>账号</span>
                <strong>{profile?.username ?? actor.username}</strong>
              </article>
              <article className="profile-card">
                <ClipboardList size={22} />
                <span>学号/工号</span>
                <strong>{profile?.studentId ?? "-"}</strong>
              </article>
              <article className="profile-card">
                <ShieldCheck size={22} />
                <span>角色</span>
                <strong>{roleText(profile?.role ?? actor.role)}</strong>
              </article>
              <article className="profile-card">
                <Smartphone size={22} />
                <span>绑定手机</span>
                <strong>{profile?.phone ?? "未绑定"}</strong>
              </article>
              <form className="contact-form" onSubmit={updateContact}>
                <label>
                  修改绑定手机
                  <input
                    placeholder="请输入 11 位手机号"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                  />
                </label>
                <button className="primary" disabled={loading}>
                  {loading ? "保存中..." : "保存手机号"}
                </button>
              </form>
            </div>
          ) : null}

          {accountTab === "security" ? (
            <form className="security-form" onSubmit={changePassword}>
              <div className="security-title">
                <KeyRound size={22} />
                <div>
                  <h3>修改登录密码</h3>
                  <p>本地账号可在此修改密码；统一身份认证账号以后将跳转到学校认证系统处理。</p>
                </div>
              </div>
              <label>
                当前密码
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label>
                新密码
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label>
                确认新密码
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <button className="primary" disabled={loading}>
                {loading ? "修改中..." : "修改密码"}
              </button>
            </form>
          ) : null}

          {accountTab === "list" && canManageUsers ? (
            <div className="account-list">
              <label className="search-box">
                搜索账号
                <input
                  placeholder="按账号、姓名、学号/工号搜索"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                />
              </label>

              <div className={`account-table list-frame ${showAllAccounts ? "expanded" : ""}`}>
                <div className="account-head">
                  <span>账号</span>
                  <span>姓名</span>
                  <span>学号/工号</span>
                  <span>手机</span>
                  <span>角色</span>
                  <span>来源</span>
                  <span>状态</span>
                  <span>操作</span>
                </div>
                {displayedUsers.map((user) => (
                  <div className="account-row" key={user.id}>
                    <span>{user.username}</span>
                    <span>{user.displayName}</span>
                    <span>{user.studentId ?? "-"}</span>
                    <span>{user.phone ?? "-"}</span>
                    <span>{roleText(user.role)}</span>
                    <span>{user.identityProvider}</span>
                    <span>{user.active ? "启用" : "停用"}</span>
                    <span className="row-actions">
                      {user.role === "member" && user.active ? (
                        <>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => resetUserPassword(user)}
                          >
                            重置密码
                          </button>
                          <button type="button" disabled={loading} onClick={() => deleteUser(user)}>
                            删除
                          </button>
                        </>
                      ) : (
                        <small>-</small>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {hasMoreUsers ? (
                <button
                  className="ghost more-button"
                  type="button"
                  onClick={() => setShowAllAccounts((value) => !value)}
                >
                  {showAllAccounts
                    ? "收起"
                    : `展示更多（还有 ${users.length - accountPreviewLimit} 个）`}
                </button>
              ) : null}
            </div>
          ) : null}

          {accountTab === "register" && canManageUsers ? (
            <form className="member-form" onSubmit={registerUser}>
              <label>
                登录账号
                <input
                  value={registerUsername}
                  onChange={(event) => setRegisterUsername(event.target.value)}
                />
              </label>
              <label>
                姓名
                <input
                  value={registerDisplayName}
                  onChange={(event) => setRegisterDisplayName(event.target.value)}
                />
              </label>
              <label>
                学号/工号
                <input
                  value={registerStudentId}
                  onChange={(event) => setRegisterStudentId(event.target.value)}
                />
              </label>
              <label>
                初始密码
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                />
              </label>
              <label>
                角色
                <select
                  value={registerRole}
                  onChange={(event) => setRegisterRole(event.target.value as "admin" | "member")}
                >
                  <option value="member">成员</option>
                  <option value="admin">管理员</option>
                </select>
              </label>
              <button className="primary" disabled={loading}>
                {loading ? "创建中..." : "创建账号"}
              </button>
            </form>
          ) : null}
        </section>

        <section className="module-strip">
          <ModuleCard title="项目任务" text="项目、任务、看板入口已预留。" />
          <ModuleCard title="文件资料" text="Synology Drive 适配入口已预留。" />
          <ModuleCard title="统一认证" text="ids.xmu.edu.cn 适配器后续接入。" />
        </section>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <article className={`metric ${tone ?? ""}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ModuleCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="module-card">
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
