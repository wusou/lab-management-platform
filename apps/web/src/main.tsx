import {
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Send,
  ShieldCheck,
  Users,
  XCircle
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Role = "member" | "admin";
type ApplicationStatus = "pending" | "approved" | "rejected";

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

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function authHeaders(role: Role) {
  return {
    Authorization: `Bearer ${role}`,
    "Content-Type": "application/json"
  };
}

function statusText(status: ApplicationStatus) {
  return {
    pending: "待审批",
    approved: "已批准",
    rejected: "已拒绝"
  }[status];
}

function App() {
  const [role, setRole] = useState<Role>("member");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [applications, setApplications] = useState<InventoryApplication[]>([]);
  const [summary, setSummary] = useState<Summary>({
    materialCount: 0,
    lowStockCount: 0,
    pendingApplications: 0,
    approvedApplications: 0
  });
  const [selectedMaterialId, setSelectedMaterialId] = useState("m-001");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("课题实验耗材申请");
  const [message, setMessage] = useState("系统已连接，选择耗材即可提交申请。");
  const [loading, setLoading] = useState(false);

  async function loadData(activeRole = role) {
    const [summaryResponse, materialsResponse, applicationsResponse] = await Promise.all([
      fetch(`${apiBase}/inventory/summary`, { headers: authHeaders(activeRole) }),
      fetch(`${apiBase}/inventory/materials`, { headers: authHeaders(activeRole) }),
      fetch(`${apiBase}/inventory/applications`, { headers: authHeaders(activeRole) })
    ]);

    if (!summaryResponse.ok || !materialsResponse.ok || !applicationsResponse.ok) {
      throw new Error("数据加载失败，请确认 API 容器正在运行。");
    }

    setSummary(await summaryResponse.json());
    setMaterials(await materialsResponse.json());
    setApplications(await applicationsResponse.json());
  }

  useEffect(() => {
    loadData().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "系统连接失败");
    });
  }, []);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === selectedMaterialId),
    [materials, selectedMaterialId]
  );

  const pendingApplications = applications.filter(
    (application) => application.status === "pending"
  );
  const myApplications = applications.filter((application) =>
    role === "member" ? application.applicantId === "demo-member" : true
  );

  async function switchRole(nextRole: Role) {
    setRole(nextRole);
    setMessage(
      nextRole === "admin" ? "已切换为管理员，可审批申请。" : "已切换为成员，可提交申请。"
    );
    await loadData(nextRole);
  }

  async function submitApplication(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/inventory/applications`, {
        method: "POST",
        headers: authHeaders("member"),
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
      await loadData(role);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "申请提交失败");
    } finally {
      setLoading(false);
    }
  }

  async function reviewApplication(id: string, action: "approve" | "reject") {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/inventory/applications/${id}/${action}`, {
        method: "PATCH",
        headers: authHeaders("admin"),
        body: JSON.stringify({
          remark: action === "approve" ? "库存确认无误，批准领用。" : "请补充实验说明后重新提交。"
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "审批失败");
      }
      setMessage(action === "approve" ? "已批准申请并扣减库存。" : "已拒绝申请。");
      await loadData(role);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审批失败");
    } finally {
      setLoading(false);
    }
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
            成员权限
          </a>
        </nav>

        <div className="role-card">
          <span>当前身份</span>
          <div className="role-switch">
            <button
              className={role === "member" ? "selected" : ""}
              onClick={() => switchRole("member")}
            >
              成员
            </button>
            <button
              className={role === "admin" ? "selected" : ""}
              onClick={() => switchRole("admin")}
            >
              管理员
            </button>
          </div>
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
            <button className="ghost">
              <LogOut size={17} />
              演示账号
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
                <h2>提交领用申请</h2>
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
          </form>
        </section>

        <section className="panel" id="applications">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Approval</p>
              <h2>{role === "admin" ? "审批队列" : "我的申请记录"}</h2>
            </div>
            <span>{role === "admin" ? pendingApplications.length : myApplications.length} 条</span>
          </div>

          <div className="table">
            <div className="table-head">
              <span>耗材</span>
              <span>申请人</span>
              <span>数量</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            {(role === "admin" ? applications : myApplications).map((application) => (
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
                  {role === "admin" && application.status === "pending" ? (
                    <>
                      <button onClick={() => reviewApplication(application.id, "approve")}>
                        <CheckCircle2 size={16} />
                        批准
                      </button>
                      <button onClick={() => reviewApplication(application.id, "reject")}>
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
        </section>

        <section className="module-strip">
          <ModuleCard
            title="项目任务"
            text="项目、任务、看板入口已预留，下一步接入 project 插件。"
          />
          <ModuleCard
            title="文件资料"
            text="文件上传、权限、NAS 适配入口已预留，下一步接入 file 插件。"
          />
          <ModuleCard
            title="会议通知"
            text="公告、会议预约、邮件提醒入口已预留，下一步接入 notification 插件。"
          />
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
