import {
  Bell,
  BookOpen,
  Bot,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileText,
  FlaskConical,
  Folder,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  Megaphone,
  MessageCircle,
  PackageCheck,
  Plus,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  Users,
  XCircle
} from "lucide-react";
import type { ReactNode, SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Role = "super_admin" | "admin" | "member";
type Permission =
  | "user:read"
  | "user:write"
  | "inventory:read"
  | "inventory:write"
  | "file:read"
  | "file:write"
  | "project:read"
  | "project:write"
  | "meeting:read"
  | "meeting:write"
  | "ai:use";
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

interface StockMovement {
  id: string;
  materialId: string;
  materialName: string;
  operatorId: string;
  quantity: number;
  type: "stock_in" | "application_out";
  remark: string;
  createdAt: string;
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

type FileCategory = "sop" | "template" | "record" | "dataset" | "meeting" | "other";
type FileNodeType = "folder" | "file";
type FileVisibility = "public" | "group" | "private";
type StorageProvider = "database" | "synology" | "external_link";
type MeetingStatus = "scheduled" | "completed" | "cancelled";
type NotificationType = "announcement" | "meeting" | "approval" | "task" | "system";

interface LabFile {
  id: string;
  nodeType: FileNodeType;
  title: string;
  category: FileCategory;
  parentId?: string;
  tags: string[];
  visibility: FileVisibility;
  storageProvider: StorageProvider;
  driveUrl?: string;
  description: string;
  ownerId: string;
  ownerName: string;
  currentVersion: number;
  latestVersionId?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
  updatedAt: string;
}

interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64?: string;
  driveUrl?: string;
  changeNote: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
}

interface Meeting {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  onlineUrl?: string;
  participantIds: string[];
  agendaFileId?: string;
  minutesFileId?: string;
  summary: string;
  status: MeetingStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationItem {
  id: string;
  recipientId?: string;
  title: string;
  content: string;
  type: NotificationType;
  relatedType?: string;
  relatedId?: string;
  readAt?: string;
  createdBy: string;
  createdAt: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface KnowledgeSource {
  id: string;
  title: string;
  snippet: string;
}

interface ChatResponse {
  reply: string;
  sources?: KnowledgeSource[];
}

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface FaqTemplate {
  id: string;
  question: string;
  category: string;
  sortOrder: number;
}

interface ChatHistoryRecord {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const applicationPreviewLimit = 8;
const accountPreviewLimit = 10;
const defaultResetPassword = "Student@123456";
const phonePattern = /^1[3-9]\d{9}$/;

function toDatetimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

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

function fileCategoryText(category: FileCategory) {
  return {
    sop: "SOP",
    template: "模板",
    record: "记录",
    dataset: "数据集",
    meeting: "会议",
    other: "其他"
  }[category];
}

function visibilityText(visibility: FileVisibility) {
  return {
    public: "公开",
    group: "课题组可见",
    private: "仅自己可见"
  }[visibility];
}

function meetingStatusText(status: MeetingStatus) {
  return {
    scheduled: "已预约",
    completed: "已完成",
    cancelled: "已取消"
  }[status];
}

function notificationTypeText(type: NotificationType) {
  return {
    announcement: "公告",
    meeting: "会议",
    approval: "审批",
    task: "任务",
    system: "系统"
  }[type];
}

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) {
    return "-";
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.ceil(sizeBytes / 1024)} KB`;
  }
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

const permissionLabels: Record<Permission, string> = {
  "user:read": "查看账号",
  "user:write": "管理账号",
  "inventory:read": "查看库存",
  "inventory:write": "库存审批",
  "file:read": "查看文件",
  "file:write": "管理文件",
  "project:read": "查看项目",
  "project:write": "管理项目",
  "meeting:read": "查看会议",
  "meeting:write": "管理会议",
  "ai:use": "使用 AI"
};

const rolePermissions: Record<Role, Permission[]> = {
  super_admin: [
    "user:read",
    "user:write",
    "inventory:read",
    "inventory:write",
    "file:read",
    "file:write",
    "project:read",
    "project:write",
    "meeting:read",
    "meeting:write",
    "ai:use"
  ],
  admin: [
    "user:read",
    "user:write",
    "inventory:read",
    "inventory:write",
    "file:read",
    "file:write",
    "project:read",
    "project:write",
    "meeting:read",
    "meeting:write",
    "ai:use"
  ],
  member: ["inventory:read", "file:read", "project:read", "meeting:read", "ai:use"]
};

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("lab_token") ?? "");
  const [actor, setActor] = useState<Actor | null>(() => {
    const raw = sessionStorage.getItem("lab_actor");
    return raw ? (JSON.parse(raw) as Actor) : null;
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [applications, setApplications] = useState<InventoryApplication[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [files, setFiles] = useState<LabFile[]>([]);
  const [fileVersions, setFileVersions] = useState<FileVersion[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerStudentId, setRegisterStudentId] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerRole, setRegisterRole] = useState<"admin" | "member">("member");
  const [accountTab, setAccountTab] = useState<
    "profile" | "security" | "list" | "roles" | "register"
  >("profile");
  const [userSearch, setUserSearch] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showAllApplications, setShowAllApplications] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [showInactiveAccounts, setShowInactiveAccounts] = useState(false);
  const [movementMaterialFilter, setMovementMaterialFilter] = useState("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");
  const [fileSearch, setFileSearch] = useState("");
  const [fileParentId, setFileParentId] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [fileTitle, setFileTitle] = useState("实验记录模板");
  const [fileCategory, setFileCategory] = useState<FileCategory>("template");
  const [fileNodeType, setFileNodeType] = useState<FileNodeType>("file");
  const [fileVisibility, setFileVisibility] = useState<FileVisibility>("public");
  const [fileTags, setFileTags] = useState("模板,实验记录");
  const [fileDriveUrl, setFileDriveUrl] = useState("https://drive.example.local/shared/template");
  const [fileDescription, setFileDescription] = useState("Synology Drive 共享链接");
  const [fileUploadName, setFileUploadName] = useState("");
  const [fileUploadMimeType, setFileUploadMimeType] = useState("");
  const [fileUploadSize, setFileUploadSize] = useState(0);
  const [fileUploadBase64, setFileUploadBase64] = useState("");
  const [versionNote, setVersionNote] = useState("更新资料版本");
  const [meetingTitle, setMeetingTitle] = useState("课题组周会");
  const [meetingStartsAt, setMeetingStartsAt] = useState(() =>
    toDatetimeLocal(new Date(Date.now() + 1000 * 60 * 60 * 24))
  );
  const [meetingEndsAt, setMeetingEndsAt] = useState(() =>
    toDatetimeLocal(new Date(Date.now() + 1000 * 60 * 60 * 25))
  );
  const [meetingLocation, setMeetingLocation] = useState("实验室会议室");
  const [meetingOnlineUrl, setMeetingOnlineUrl] = useState("");
  const [meetingParticipants, setMeetingParticipants] = useState("");
  const [meetingSummary, setMeetingSummary] = useState("同步本周实验进展与耗材申请。");
  const [announcementTitle, setAnnouncementTitle] = useState("实验室通知");
  const [announcementContent, setAnnouncementContent] = useState("请及时查看本周会议安排。");
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [aiMessage, setAiMessage] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSources, setAiSources] = useState<KnowledgeSource[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([]);
  const [faqTemplates, setFaqTemplates] = useState<FaqTemplate[]>([]);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("general");
  const [knowledgeTags, setKnowledgeTags] = useState("");
  const [editingKnowledgeId, setEditingKnowledgeId] = useState("");
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false);
  const [aiActiveTab, setAiActiveTab] = useState<"chat" | "knowledge">("chat");
  const didMountToast = useRef(false);

  const canApprove = actor?.permissions.includes("inventory:write") ?? false;
  const canManageUsers = actor?.permissions.includes("user:write") ?? false;
  const canManageFiles = actor?.permissions.includes("file:write") ?? false;
  const canManageMeetings = actor?.permissions.includes("meeting:write") ?? false;

  function headers(activeToken = token) {
    return {
      Authorization: `Bearer ${activeToken}`,
      "Content-Type": "application/json"
    };
  }

  function scrollToNotifications() {
    document
      .getElementById("notifications")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function login(event: SyntheticEvent<HTMLFormElement>) {
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

    const [summaryResponse, materialsResponse, applicationsResponse, movementsResponse] =
      await Promise.all([
        fetch(`${apiBase}/inventory/summary`, { headers: headers(activeToken) }),
        fetch(`${apiBase}/inventory/materials`, { headers: headers(activeToken) }),
        fetch(`${apiBase}/inventory/applications`, { headers: headers(activeToken) }),
        fetch(`${apiBase}/inventory/stock-movements`, { headers: headers(activeToken) })
      ]);

    if (
      !summaryResponse.ok ||
      !materialsResponse.ok ||
      !applicationsResponse.ok ||
      !movementsResponse.ok
    ) {
      throw new Error("数据加载失败，请确认 API 容器正在运行或重新登录。");
    }

    setSummary(await summaryResponse.json());
    setMaterials(await materialsResponse.json());
    setApplications(await applicationsResponse.json());
    setStockMovements(await movementsResponse.json());
  }

  async function loadUsers(
    search = userSearch,
    activeToken = token,
    includeInactive = showInactiveAccounts
  ) {
    if (!activeToken || !canManageUsers) {
      return;
    }

    const response = await fetch(
      `${apiBase}/auth/users?search=${encodeURIComponent(search)}&includeInactive=${includeInactive}`,
      {
        headers: headers(activeToken)
      }
    );
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

  async function loadFiles(search = fileSearch, activeToken = token) {
    if (!activeToken) {
      return;
    }

    const params = new URLSearchParams();
    if (search) {
      params.set("search", search);
    }
    const response = await fetch(`${apiBase}/files?${params.toString()}`, {
      headers: headers(activeToken)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "文件资料加载失败");
    }
    setFiles(payload);
  }

  async function loadFileVersions(fileId = selectedFileId, activeToken = token) {
    if (!activeToken || !fileId) {
      setFileVersions([]);
      return;
    }

    const response = await fetch(`${apiBase}/files/${fileId}/versions`, {
      headers: headers(activeToken)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "文件版本加载失败");
    }
    setFileVersions(payload);
  }

  async function loadMeetings(activeToken = token) {
    if (!activeToken) {
      return;
    }

    const response = await fetch(`${apiBase}/meetings`, {
      headers: headers(activeToken)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "会议列表加载失败");
    }
    setMeetings(payload);
  }

  async function loadNotifications(activeToken = token) {
    if (!activeToken) {
      return;
    }

    const response = await fetch(`${apiBase}/notifications`, {
      headers: headers(activeToken)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "通知加载失败");
    }
    setNotifications(payload);
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
      loadFiles(fileSearch, token).catch(() => {
        // File refresh is best-effort for background updates.
      });
      loadMeetings(token).catch(() => {
        // Meeting refresh is best-effort for background updates.
      });
      loadNotifications(token).catch(() => {
        // Notification refresh is best-effort for background updates.
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
  }, [token, fileSearch, fileParentId]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadFiles().catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "文件资料加载失败");
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [fileSearch, fileParentId, token]);

  useEffect(() => {
    if (!selectedFileId || !token) {
      setFileVersions([]);
      return;
    }

    loadFileVersions().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "文件版本加载失败");
    });
  }, [selectedFileId, token]);

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
  }, [canManageUsers, userSearch, token, showInactiveAccounts]);

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
  const filteredStockMovements = stockMovements.filter((movement) => {
    const matchesMaterial =
      movementMaterialFilter === "all" || movement.materialId === movementMaterialFilter;
    const matchesType = movementTypeFilter === "all" || movement.type === movementTypeFilter;
    return matchesMaterial && matchesType;
  });
  const currentFolders = files.filter(
    (file) => file.nodeType === "folder" && (file.parentId ?? "") === fileParentId
  );
  const currentFileItems = files.filter(
    (file) => file.nodeType === "file" && (file.parentId ?? "") === fileParentId
  );
  const selectedFile = files.find((file) => file.id === selectedFileId);
  const unreadNotifications = notifications.filter((notification) => !notification.readAt);

  useEffect(() => {
    if (!token) return;
    loadAiChatHistory();
    loadKnowledgeDocs();
    loadFaqTemplatesList();
  }, [token]);

  useEffect(() => {
    if (!didMountToast.current) {
      didMountToast.current = true;
      return;
    }

    if (!message) {
      return;
    }

    setShowToast(true);
    const timer = window.setTimeout(() => setShowToast(false), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function submitApplication(event: SyntheticEvent<HTMLFormElement>) {
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

  async function registerUser(event: SyntheticEvent<HTMLFormElement>) {
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

  async function updateContact(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phonePattern.test(contactPhone)) {
      setMessage("手机号格式不正确，请填写 11 位中国大陆手机号，例如 13800000000。");
      return;
    }
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

  async function changePassword(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("请完整填写当前密码、新密码和确认新密码。");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("新密码至少需要 8 位。");
      return;
    }
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

  async function updateUserRole(user: ManagedUser, role: "admin" | "member") {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/auth/users/${user.id}/role`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ role })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "角色更新失败");
      }
      setUsers((current) => current.map((item) => (item.id === user.id ? payload : item)));
      setMessage(`已将 ${user.displayName} 设置为${roleText(role)}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "角色更新失败");
    } finally {
      setLoading(false);
    }
  }

  async function registerFile(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/files`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          nodeType: fileNodeType,
          title: fileTitle,
          category: fileCategory,
          parentId: fileParentId || undefined,
          tags: fileTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          visibility: fileVisibility,
          driveUrl: fileDriveUrl || undefined,
          description: fileDescription,
          originalName: fileUploadName || undefined,
          mimeType: fileUploadMimeType || undefined,
          sizeBytes: fileUploadSize || undefined,
          contentBase64: fileUploadBase64 || undefined
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "文件登记失败");
      }
      setMessage(
        `${fileNodeType === "folder" ? "已创建文件夹" : "已登记文件资料"}：${payload.title}`
      );
      setFileTitle("");
      setFileDriveUrl("");
      setFileDescription("");
      setFileTags("");
      setFileUploadName("");
      setFileUploadMimeType("");
      setFileUploadSize(0);
      setFileUploadBase64("");
      setFileCategory("template");
      setFileNodeType("file");
      setSelectedFileId(payload.id);
      await loadFiles("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "文件登记失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileContentChange(file: File | null) {
    if (!file) {
      setFileUploadName("");
      setFileUploadMimeType("");
      setFileUploadSize(0);
      setFileUploadBase64("");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("当前 MVP 支持 5MB 以内小文件直传；大文件请先使用 NAS 链接登记。");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsDataURL(file);
    });
    setFileUploadName(file.name);
    setFileUploadMimeType(file.type || "application/octet-stream");
    setFileUploadSize(file.size);
    setFileUploadBase64(dataUrl.split(",")[1] ?? "");
    if (!fileTitle.trim()) {
      setFileTitle(file.name);
    }
  }

  async function addFileVersion(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFileId) {
      setMessage("请先选择一个文件。");
      return;
    }
    if (!fileUploadBase64 && !fileDriveUrl) {
      setMessage("请上传小文件或填写 NAS 链接。");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/files/${selectedFileId}/versions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          originalName: fileUploadName || selectedFile?.originalName || "file.link",
          mimeType: fileUploadMimeType || selectedFile?.mimeType || "text/uri-list",
          sizeBytes: fileUploadSize || 0,
          contentBase64: fileUploadBase64 || undefined,
          driveUrl: fileDriveUrl || undefined,
          changeNote: versionNote
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "版本更新失败");
      }
      setMessage(`已新增版本：v${payload.version}`);
      setFileUploadName("");
      setFileUploadMimeType("");
      setFileUploadSize(0);
      setFileUploadBase64("");
      setFileDriveUrl("");
      await loadFiles();
      await loadFileVersions(selectedFileId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "版本更新失败");
    } finally {
      setLoading(false);
    }
  }

  async function downloadFileVersion(version: FileVersion) {
    const response = await fetch(
      `${apiBase}/files/${version.fileId}/versions/${version.id}/download`,
      { headers: headers() }
    );
    const payload = (await response.json()) as FileVersion & { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "下载失败");
      return;
    }
    if (payload.driveUrl && !payload.contentBase64) {
      window.open(payload.driveUrl, "_blank", "noreferrer");
      return;
    }
    if (!payload.contentBase64) {
      setMessage("该版本没有可下载内容。");
      return;
    }
    const byteCharacters = atob(payload.contentBase64);
    const byteNumbers = Array.from(byteCharacters, (character) => character.charCodeAt(0));
    const blob = new Blob([new Uint8Array(byteNumbers)], {
      type: payload.mimeType || "application/octet-stream"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = payload.originalName;
    link.click();
    URL.revokeObjectURL(url);
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

  async function createMeeting(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/meetings`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          title: meetingTitle,
          startsAt: new Date(meetingStartsAt).toISOString(),
          endsAt: new Date(meetingEndsAt).toISOString(),
          location: meetingLocation,
          onlineUrl: meetingOnlineUrl || undefined,
          participantIds: meetingParticipants
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          summary: meetingSummary
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "会议创建失败");
      }
      setMessage(`已创建会议：${payload.title}`);
      await loadMeetings();
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "会议创建失败");
    } finally {
      setLoading(false);
    }
  }

  async function completeMeeting(meeting: Meeting) {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/meetings/${meeting.id}/minutes`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          summary: `${meeting.summary}\n纪要：会议已完成，纪要文件可在文件资料模块登记后关联。`,
          status: "completed"
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "会议更新失败");
      }
      setMeetings((current) => current.map((item) => (item.id === meeting.id ? payload : item)));
      setMessage("会议已标记完成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "会议更新失败");
    } finally {
      setLoading(false);
    }
  }

  async function publishAnnouncement(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/announcements`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          title: announcementTitle,
          content: announcementContent
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "公告发布失败");
      }
      setMessage("公告已发布。");
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "公告发布失败");
    } finally {
      setLoading(false);
    }
  }

  async function markNotificationRead(notification: NotificationItem) {
    try {
      const response = await fetch(`${apiBase}/notifications/${notification.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "通知更新失败");
      }
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? payload : item))
      );
      setSelectedNotification((current) => (current?.id === payload.id ? payload : current));
      setMessage(`已读：${payload.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "通知更新失败");
    }
  }

  async function sendAiMessage(event?: SyntheticEvent<HTMLFormElement>) {
    event?.preventDefault();
    const message = aiMessage.trim();
    if (!message || aiLoading) return;

    setAiMessage("");
    setAiError("");
    const userMsg: ChatMessage = { role: "user", content: message };
    setAiChatMessages((prev) => [...prev, userMsg]);
    setAiLoading(true);

    try {
      const response = await fetch(`${apiBase}/ai/chat`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ message })
      });
      const payload = (await response.json()) as ChatResponse & { error?: string; detail?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "AI 请求失败");
      }

      const assistantMsg: ChatMessage = { role: "assistant", content: payload.reply };
      setAiChatMessages((prev) => [...prev, assistantMsg]);
      setAiSources(payload.sources ?? []);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "AI 服务连接失败";
      setAiError(errMsg);
    } finally {
      setAiLoading(false);
    }
  }

  async function clearAiHistory() {
    try {
      await fetch(`${apiBase}/ai/chat-history`, {
        method: "DELETE",
        headers: headers()
      });
      setAiChatMessages([]);
      setAiSources([]);
      setAiError("");
      setMessage("对话历史已清除。");
    } catch {
      setMessage("清除历史失败。");
    }
  }

  async function loadAiChatHistory() {
    try {
      const response = await fetch(`${apiBase}/ai/chat-history`, {
        headers: headers()
      });
      if (!response.ok) return;
      const history = (await response.json()) as ChatHistoryRecord[];
      setAiChatMessages(history.map((h) => ({ role: h.role, content: h.content })));
    } catch {
      // Best-effort background load
    }
  }

  async function loadKnowledgeDocs() {
    try {
      const response = await fetch(`${apiBase}/ai/knowledge`, { headers: headers() });
      if (!response.ok) return;
      setKnowledgeDocs(await response.json());
    } catch {
      // Best-effort
    }
  }

  async function loadFaqTemplatesList() {
    try {
      const response = await fetch(`${apiBase}/ai/templates`, { headers: headers() });
      if (!response.ok) return;
      setFaqTemplates(await response.json());
    } catch {
      // Best-effort
    }
  }

  async function createKnowledgeDoc(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch(`${apiBase}/ai/knowledge`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          title: knowledgeTitle,
          content: knowledgeContent,
          category: knowledgeCategory,
          tags: knowledgeTags.split(",").map((t) => t.trim()).filter(Boolean)
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "添加知识库失败");
      setMessage(`已添加知识文档：${payload.title}`);
      setKnowledgeTitle("");
      setKnowledgeContent("");
      setKnowledgeTags("");
      await loadKnowledgeDocs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "添加失败");
    } finally {
      setAiLoading(false);
    }
  }

  async function updateKnowledgeDoc(id: string) {
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch(`${apiBase}/ai/knowledge/${id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({
          title: knowledgeTitle,
          content: knowledgeContent,
          category: knowledgeCategory,
          tags: knowledgeTags.split(",").map((t) => t.trim()).filter(Boolean)
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "更新知识库失败");
      setMessage(`已更新知识文档：${payload.title}`);
      setEditingKnowledgeId("");
      setKnowledgeTitle("");
      setKnowledgeContent("");
      setKnowledgeCategory("general");
      setKnowledgeTags("");
      await loadKnowledgeDocs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败");
    } finally {
      setAiLoading(false);
    }
  }

  async function deleteKnowledgeDoc(id: string) {
    if (!window.confirm("确认删除该知识库文档？")) return;
    try {
      const response = await fetch(`${apiBase}/ai/knowledge/${id}`, {
        method: "DELETE",
        headers: headers()
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "删除失败");
      }
      setMessage("知识文档已删除。");
      if (editingKnowledgeId === id) {
        setEditingKnowledgeId("");
        setKnowledgeTitle("");
        setKnowledgeContent("");
      }
      await loadKnowledgeDocs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    }
  }

  function startEditKnowledge(doc: KnowledgeDocument) {
    setEditingKnowledgeId(doc.id);
    setKnowledgeTitle(doc.title);
    setKnowledgeContent(doc.content);
    setKnowledgeCategory(doc.category);
    setKnowledgeTags(doc.tags.join(", "));
    setShowKnowledgePanel(true);
  }

  function useFaqTemplate(question: string) {
    setAiMessage(question);
    setAiActiveTab("chat");
  }

  if (!actor) {
    return (
      <main className="login-shell">
        <form className="login-panel" onSubmit={login} autoComplete="off">
          <div className="brand login-brand">
            <FlaskConical size={30} />
            <div>
              <strong>实验室管理平台</strong>
              <span>Lab Ops Console</span>
            </div>
          </div>
          <h1>登录工作台</h1>
          <p>可使用账号、学号/工号或手机号登录。</p>
          <label>
            账号 / 学号 / 手机号
            <input
              value={username}
              autoComplete="off"
              placeholder="请输入账号、学号/工号或手机号"
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              autoComplete="new-password"
              placeholder="请输入密码"
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
          <a href="#stock-movements">
            <PackageCheck size={18} />
            库存流水
          </a>
          <a href="#files">
            <FileText size={18} />
            文件资料
          </a>
          <a href="#meetings">
            <CalendarClock size={18} />
            会议通知
          </a>
          <a href="#members">
            <Users size={18} />
            账户管理
          </a>
          <a href="#ai">
            <Bot size={18} />
            AI 助手
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
        {showToast ? (
          <div className="toast" role="status" aria-live="polite">
            <Bell size={16} />
            {message}
          </div>
        ) : null}

        <header className="topbar">
          <div>
            <p className="eyebrow">今日实验室运营</p>
            <h1>耗材申请与审批工作台</h1>
          </div>
          <div className="top-actions">
            <button className="notice notice-button" type="button" onClick={scrollToNotifications}>
              <Bell size={17} />
              {unreadNotifications.length} 条未读 · 查看通知
            </button>
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

        <section className="panel" id="stock-movements">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Stock Ledger</p>
              <h2>库存流水查询</h2>
            </div>
            <span>{filteredStockMovements.length} 条</span>
          </div>

          <div className="movement-toolbar">
            <label>
              耗材
              <select
                value={movementMaterialFilter}
                onChange={(event) => setMovementMaterialFilter(event.target.value)}
              >
                <option value="all">全部耗材</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              类型
              <select
                value={movementTypeFilter}
                onChange={(event) => setMovementTypeFilter(event.target.value)}
              >
                <option value="all">全部类型</option>
                <option value="stock_in">入库</option>
                <option value="application_out">审批出库</option>
              </select>
            </label>
          </div>

          <div className="movement-table list-frame">
            <div className="movement-head">
              <span>时间</span>
              <span>耗材</span>
              <span>类型</span>
              <span>数量</span>
              <span>操作人</span>
              <span>备注</span>
            </div>
            {filteredStockMovements.map((movement) => (
              <div className="movement-row" key={movement.id}>
                <span>{new Date(movement.createdAt).toLocaleString()}</span>
                <span>{movement.materialName}</span>
                <span>{movement.type === "stock_in" ? "入库" : "审批出库"}</span>
                <span className={movement.quantity < 0 ? "danger" : ""}>{movement.quantity}</span>
                <span>{movement.operatorId}</span>
                <span>{movement.remark}</span>
              </div>
            ))}
            {filteredStockMovements.length === 0 ? (
              <div className="empty-row">暂无符合条件的库存流水。</div>
            ) : null}
          </div>
        </section>

        <section className="panel" id="files">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Files</p>
              <h2>文件资料与版本</h2>
            </div>
            <FileText size={20} />
          </div>

          <div className="file-layout">
            <div className="file-list">
              <div className="file-toolbar">
                <label className="search-box">
                  搜索资料
                  <input
                    placeholder="按标题、标签、上传者搜索"
                    value={fileSearch}
                    onChange={(event) => setFileSearch(event.target.value)}
                  />
                </label>
                <label>
                  当前文件夹
                  <select
                    value={fileParentId}
                    onChange={(event) => {
                      setFileParentId(event.target.value);
                      setSelectedFileId("");
                    }}
                  >
                    <option value="">全部 / 根目录</option>
                    {files
                      .filter((file) => file.nodeType === "folder")
                      .map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.title}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <div className="file-grid list-frame">
                {currentFolders.map((folder) => (
                  <article
                    className="file-card folder-card"
                    key={folder.id}
                    onClick={() => {
                      setFileParentId(folder.id);
                      setSelectedFileId("");
                    }}
                  >
                    <div>
                      <b>
                        <Folder size={15} />
                        文件夹
                      </b>
                      <span>{visibilityText(folder.visibility)}</span>
                    </div>
                    <h3>{folder.title}</h3>
                    <p>{folder.description}</p>
                    <small>{folder.tags.join(" / ") || "未设置标签"}</small>
                  </article>
                ))}
                {currentFileItems.map((file) => (
                  <article
                    className={`file-card ${selectedFileId === file.id ? "selected" : ""}`}
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                  >
                    <div>
                      <b>{fileCategoryText(file.category)}</b>
                      <span>v{file.currentVersion}</span>
                    </div>
                    <h3>{file.title}</h3>
                    <p>{file.description}</p>
                    <small>
                      {visibilityText(file.visibility)} · {formatFileSize(file.sizeBytes)} ·{" "}
                      {file.ownerName}
                    </small>
                    {file.driveUrl ? (
                      <a href={file.driveUrl} target="_blank" rel="noreferrer">
                        <LinkIcon size={16} />
                        打开 NAS/外部链接
                      </a>
                    ) : null}
                  </article>
                ))}
                {files.length === 0 ? <div className="empty-row">暂无文件资料。</div> : null}
              </div>

              {selectedFile ? (
                <div className="version-panel">
                  <div className="panel-head compact">
                    <div>
                      <p className="eyebrow">Versions</p>
                      <h3>{selectedFile.title}</h3>
                    </div>
                    <span>{fileVersions.length} 个版本</span>
                  </div>
                  {fileVersions.map((version) => (
                    <div className="version-row" key={version.id}>
                      <span>
                        <strong>v{version.version}</strong>
                        <small>
                          {version.originalName} · {formatFileSize(version.sizeBytes)} ·{" "}
                          {version.uploaderName}
                        </small>
                      </span>
                      <button type="button" onClick={() => downloadFileVersion(version)}>
                        <Download size={15} />
                        下载/打开
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {canManageFiles ? (
              <div className="file-form-stack">
                <form className="file-form" onSubmit={registerFile}>
                  <h3>创建文件/文件夹</h3>
                  <label>
                    类型
                    <select
                      value={fileNodeType}
                      onChange={(event) => setFileNodeType(event.target.value as FileNodeType)}
                    >
                      <option value="file">文件</option>
                      <option value="folder">文件夹</option>
                    </select>
                  </label>
                  <label>
                    标题
                    <input
                      value={fileTitle}
                      onChange={(event) => setFileTitle(event.target.value)}
                    />
                  </label>
                  <label>
                    分类
                    <select
                      value={fileCategory}
                      onChange={(event) => setFileCategory(event.target.value as FileCategory)}
                    >
                      <option value="sop">SOP</option>
                      <option value="template">模板</option>
                      <option value="record">记录</option>
                      <option value="dataset">数据集</option>
                      <option value="meeting">会议资料</option>
                      <option value="other">其他</option>
                    </select>
                  </label>
                  <label>
                    权限
                    <select
                      value={fileVisibility}
                      onChange={(event) => setFileVisibility(event.target.value as FileVisibility)}
                    >
                      <option value="public">公开</option>
                      <option value="group">课题组可见</option>
                      <option value="private">仅自己可见</option>
                    </select>
                  </label>
                  <label>
                    标签
                    <input value={fileTags} onChange={(event) => setFileTags(event.target.value)} />
                  </label>
                  {fileNodeType === "file" ? (
                    <>
                      <label>
                        小文件上传
                        <input
                          type="file"
                          onChange={(event) =>
                            handleFileContentChange(event.currentTarget.files?.[0] ?? null)
                          }
                        />
                      </label>
                      <label>
                        NAS / 外部链接
                        <input
                          value={fileDriveUrl}
                          onChange={(event) => setFileDriveUrl(event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}
                  <label>
                    说明
                    <textarea
                      value={fileDescription}
                      onChange={(event) => setFileDescription(event.target.value)}
                    />
                  </label>
                  <button className="primary" disabled={loading}>
                    {loading ? "保存中..." : fileNodeType === "folder" ? "创建文件夹" : "保存资料"}
                  </button>
                </form>

                {selectedFile ? (
                  <form className="file-form" onSubmit={addFileVersion}>
                    <h3>新增文件版本</h3>
                    <label>
                      版本文件
                      <input
                        type="file"
                        onChange={(event) =>
                          handleFileContentChange(event.currentTarget.files?.[0] ?? null)
                        }
                      />
                    </label>
                    <label>
                      或填写 NAS 链接
                      <input
                        value={fileDriveUrl}
                        onChange={(event) => setFileDriveUrl(event.target.value)}
                      />
                    </label>
                    <label>
                      更新说明
                      <textarea
                        value={versionNote}
                        onChange={(event) => setVersionNote(event.target.value)}
                      />
                    </label>
                    <button className="primary" disabled={loading}>
                      <Upload size={16} />
                      {loading ? "更新中..." : "新增版本"}
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel" id="meetings">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Meetings & Notices</p>
              <h2>会议与通知管理</h2>
            </div>
            <CalendarClock size={20} />
          </div>

          <div className="meeting-layout">
            <div className="meeting-list list-frame">
              {meetings.map((meeting) => (
                <article className="meeting-card" key={meeting.id}>
                  <div>
                    <b className={`pill ${meeting.status}`}>{meetingStatusText(meeting.status)}</b>
                    <span>{new Date(meeting.startsAt).toLocaleString()}</span>
                  </div>
                  <h3>{meeting.title}</h3>
                  <p>{meeting.summary}</p>
                  <small>
                    {meeting.location} · 参会 {meeting.participantIds.length} 人 · 创建人{" "}
                    {meeting.createdByName}
                  </small>
                  <div className="row-actions">
                    {meeting.onlineUrl ? (
                      <a href={meeting.onlineUrl} target="_blank" rel="noreferrer">
                        <LinkIcon size={15} />
                        打开会议链接
                      </a>
                    ) : null}
                    {canManageMeetings && meeting.status === "scheduled" ? (
                      <button type="button" onClick={() => completeMeeting(meeting)}>
                        <CheckCircle2 size={15} />
                        标记完成
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {meetings.length === 0 ? <div className="empty-row">暂无会议。</div> : null}
            </div>

            <div className="notice-list list-frame" id="notifications">
              <div className="panel-head compact">
                <div>
                  <p className="eyebrow">Inbox</p>
                  <h3>站内通知</h3>
                </div>
                <span>{unreadNotifications.length} 未读</span>
              </div>
              {notifications.map((notification) => (
                <article
                  className={`notice-card ${notification.readAt ? "" : "unread"}`}
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedNotification(notification)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedNotification(notification);
                    }
                  }}
                >
                  <div>
                    <b>{notificationTypeText(notification.type)}</b>
                    <span>{new Date(notification.createdAt).toLocaleString()}</span>
                  </div>
                  <h3>{notification.title}</h3>
                  <p>{notification.content}</p>
                  {!notification.readAt ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void markNotificationRead(notification);
                      }}
                    >
                      标记已读
                    </button>
                  ) : null}
                </article>
              ))}
              {notifications.length === 0 ? <div className="empty-row">暂无通知。</div> : null}
            </div>

            {canManageMeetings ? (
              <div className="meeting-actions">
                <form className="meeting-form" onSubmit={createMeeting}>
                  <h3>创建会议</h3>
                  <label>
                    主题
                    <input
                      value={meetingTitle}
                      onChange={(event) => setMeetingTitle(event.target.value)}
                    />
                  </label>
                  <label>
                    开始时间
                    <input
                      type="datetime-local"
                      value={meetingStartsAt}
                      onChange={(event) => setMeetingStartsAt(event.target.value)}
                    />
                  </label>
                  <label>
                    结束时间
                    <input
                      type="datetime-local"
                      value={meetingEndsAt}
                      onChange={(event) => setMeetingEndsAt(event.target.value)}
                    />
                  </label>
                  <label>
                    地点
                    <input
                      value={meetingLocation}
                      onChange={(event) => setMeetingLocation(event.target.value)}
                    />
                  </label>
                  <label>
                    腾讯会议/线上链接
                    <input
                      value={meetingOnlineUrl}
                      onChange={(event) => setMeetingOnlineUrl(event.target.value)}
                    />
                  </label>
                  <label>
                    参会人 ID
                    <input
                      placeholder="多个用户 ID 用英文逗号分隔"
                      value={meetingParticipants}
                      onChange={(event) => setMeetingParticipants(event.target.value)}
                    />
                  </label>
                  <label>
                    议程说明
                    <textarea
                      value={meetingSummary}
                      onChange={(event) => setMeetingSummary(event.target.value)}
                    />
                  </label>
                  <button className="primary" disabled={loading}>
                    <CalendarClock size={16} />
                    {loading ? "创建中..." : "创建会议"}
                  </button>
                </form>

                <form className="meeting-form" onSubmit={publishAnnouncement}>
                  <h3>发布公告</h3>
                  <label>
                    标题
                    <input
                      value={announcementTitle}
                      onChange={(event) => setAnnouncementTitle(event.target.value)}
                    />
                  </label>
                  <label>
                    内容
                    <textarea
                      value={announcementContent}
                      onChange={(event) => setAnnouncementContent(event.target.value)}
                    />
                  </label>
                  <button className="primary" disabled={loading}>
                    <Megaphone size={16} />
                    {loading ? "发布中..." : "发布公告"}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
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
                  className={accountTab === "roles" ? "selected" : ""}
                  onClick={() => setAccountTab("roles")}
                >
                  角色权限
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
              <div className="account-toolbar">
                <label className="search-box">
                  搜索账号
                  <input
                    placeholder="按账号、姓名、学号/工号搜索"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                  />
                </label>
                <label className="toggle-line">
                  <input
                    type="checkbox"
                    checked={showInactiveAccounts}
                    onChange={(event) => setShowInactiveAccounts(event.target.checked)}
                  />
                  显示停用账号
                </label>
              </div>

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
                    <span>
                      {user.active && user.id !== actor.id && user.role !== "super_admin" ? (
                        <select
                          className="role-select"
                          value={user.role}
                          disabled={loading}
                          onChange={(event) =>
                            updateUserRole(user, event.target.value as "admin" | "member")
                          }
                        >
                          <option value="member">成员</option>
                          <option value="admin">管理员</option>
                        </select>
                      ) : (
                        roleText(user.role)
                      )}
                    </span>
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

          {accountTab === "roles" && canManageUsers ? (
            <div className="role-permission-grid">
              {(["member", "admin", "super_admin"] as Role[]).map((role) => (
                <article className="role-permission-card" key={role}>
                  <div>
                    <ShieldCheck size={22} />
                    <h3>{roleText(role)}</h3>
                  </div>
                  <p>
                    {role === "member"
                      ? "普通成员只保留申请、查看资料与参与项目的基础权限。"
                      : "管理员负责账号、库存、文件、项目与会议的日常管理。"}
                  </p>
                  <div className="permission-pills">
                    {rolePermissions[role].map((permission) => (
                      <span key={permission}>{permissionLabels[permission]}</span>
                    ))}
                  </div>
                </article>
              ))}
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

        <section className="panel" id="ai">
          <div className="panel-head">
            <div>
              <p className="eyebrow">AI Assistant</p>
              <h2>AI 智能助手</h2>
            </div>
            <Bot size={20} />
          </div>

          <div className="subnav">
            <button
              type="button"
              className={aiActiveTab === "chat" ? "selected" : ""}
              onClick={() => setAiActiveTab("chat")}
            >
              <MessageCircle size={15} />
              对话问答
            </button>
            <button
              type="button"
              className={aiActiveTab === "knowledge" ? "selected" : ""}
              onClick={() => {
                setAiActiveTab("knowledge");
                loadKnowledgeDocs();
              }}
            >
              <BookOpen size={15} />
              知识库
            </button>
          </div>

          {aiActiveTab === "chat" ? (
            <div className="ai-chat-layout">
              <div className="ai-chat-main">
                <div className="ai-chat-messages">
                  {aiChatMessages.length === 0 ? (
                    <div className="ai-welcome">
                      <Bot size={40} />
                      <h3>你好！我是实验室智能助手</h3>
                      <p>我可以帮助你解答实验流程、耗材申请、设备使用、安全规范等问题。请在下方输入你的问题。</p>
                    </div>
                  ) : (
                    aiChatMessages.map((msg, idx) => (
                      <div key={idx} className={`ai-message ${msg.role}`}>
                        <div className="ai-message-avatar">
                          {msg.role === "user" ? <Users size={16} /> : <Bot size={16} />}
                        </div>
                        <div className="ai-message-content">
                          <span className="ai-message-role">
                            {msg.role === "user" ? "你" : "AI 助手"}
                          </span>
                          <p>{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {aiLoading ? (
                    <div className="ai-message assistant">
                      <div className="ai-message-avatar"><Bot size={16} /></div>
                      <div className="ai-message-content">
                        <span className="ai-message-role">AI 助手</span>
                        <p className="ai-typing">正在思考中...</p>
                      </div>
                    </div>
                  ) : null}
                  {aiError ? (
                    <div className="ai-error-banner">
                      <XCircle size={16} />
                      <span>{aiError}</span>
                    </div>
                  ) : null}
                </div>

                {aiSources.length > 0 ? (
                  <div className="ai-sources">
                    <span>参考知识库文档：</span>
                    {aiSources.map((src) => (
                      <span key={src.id} className="ai-source-tag">{src.title}</span>
                    ))}
                  </div>
                ) : null}

                <form
                  className="ai-chat-input"
                  onSubmit={(e) => { e.preventDefault(); void sendAiMessage(); }}
                >
                  <div className="ai-chat-input-wrap">
                    <textarea
                      placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
                      value={aiMessage}
                      rows={1}
                      onChange={(event) => {
                        setAiMessage(event.target.value);
                        const el = event.currentTarget;
                        el.style.height = "auto";
                        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendAiMessage();
                        }
                      }}
                      disabled={aiLoading}
                    />
                    <button type="submit" className="send-btn" disabled={aiLoading || !aiMessage.trim()} title="发送 (Enter)">
                      <Send size={15} />
                    </button>
                  </div>
                  {aiChatMessages.length > 0 ? (
                    <button type="button" className="ghost" onClick={clearAiHistory} title="清除历史">
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </form>
              </div>

              <div className="ai-faq-sidebar">
                <h4><HelpCircle size={15} /> 常见问题</h4>
                {faqTemplates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    className="faq-template-btn"
                    onClick={() => useFaqTemplate(tmpl.question)}
                  >
                    {tmpl.question}
                  </button>
                ))}
                {faqTemplates.length === 0 ? (
                  <p className="ai-welcome">暂无问题模板，管理员可在知识库中添加。</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="ai-knowledge-layout">
              <div className="ai-knowledge-toolbar">
                <button
                  type="button"
                  className={!showKnowledgePanel ? "selected" : "ghost"}
                  onClick={() => {
                    setShowKnowledgePanel(false);
                    setEditingKnowledgeId("");
                    setKnowledgeTitle("");
                    setKnowledgeContent("");
                    setKnowledgeCategory("general");
                    setKnowledgeTags("");
                  }}
                >
                  文档列表
                </button>
                <button
                  type="button"
                  className={showKnowledgePanel ? "selected" : "ghost"}
                  onClick={() => {
                    setShowKnowledgePanel(true);
                    if (editingKnowledgeId) {
                      setEditingKnowledgeId("");
                      setKnowledgeTitle("");
                      setKnowledgeContent("");
                      setKnowledgeCategory("general");
                      setKnowledgeTags("");
                    }
                  }}
                >
                  <Plus size={15} />
                  添加文档
                </button>
              </div>

              {showKnowledgePanel ? (
                <form className="knowledge-form" onSubmit={editingKnowledgeId ? (e) => { e.preventDefault(); void updateKnowledgeDoc(editingKnowledgeId); } : createKnowledgeDoc}>
                  <h3>{editingKnowledgeId ? "编辑知识文档" : "添加知识文档"}</h3>
                  <label>
                    标题
                    <input
                      value={knowledgeTitle}
                      onChange={(event) => setKnowledgeTitle(event.target.value)}
                      placeholder="文档标题"
                    />
                  </label>
                  <label>
                    分类
                    <select
                      value={knowledgeCategory}
                      onChange={(event) => setKnowledgeCategory(event.target.value)}
                    >
                      <option value="general">通用</option>
                      <option value="rules">规章制度</option>
                      <option value="sop">操作流程</option>
                      <option value="safety">安全规范</option>
                      <option value="equipment">设备使用</option>
                      <option value="faq">常见问题</option>
                    </select>
                  </label>
                  <label>
                    标签
                    <input
                      value={knowledgeTags}
                      onChange={(event) => setKnowledgeTags(event.target.value)}
                      placeholder="多个标签用逗号分隔"
                    />
                  </label>
                  <label>
                    内容
                    <textarea
                      value={knowledgeContent}
                      onChange={(event) => setKnowledgeContent(event.target.value)}
                      placeholder="知识文档内容，AI 将基于此回答问题..."
                      rows={12}
                    />
                  </label>
                  <div className="row-actions">
                    <button className="primary" type="submit" disabled={aiLoading}>
                      {aiLoading ? "保存中..." : editingKnowledgeId ? "更新文档" : "添加文档"}
                    </button>
                    {editingKnowledgeId ? (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setEditingKnowledgeId("");
                          setKnowledgeTitle("");
                          setKnowledgeContent("");
                          setKnowledgeCategory("general");
                          setKnowledgeTags("");
                          setShowKnowledgePanel(false);
                        }}
                      >
                        取消编辑
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : (
                <div className="knowledge-list">
                  {knowledgeDocs.length === 0 ? (
                    <div className="ai-welcome">
                      <BookOpen size={32} />
                      <h3>知识库为空</h3>
                      <p>点击"添加文档"上传实验室规章制度、操作流程、常见问题等，AI 将基于这些知识回答问题。</p>
                    </div>
                  ) : (
                    knowledgeDocs.map((doc) => (
                      <article className="knowledge-card" key={doc.id}>
                        <div className="knowledge-card-header">
                          <div>
                            <strong>{doc.title}</strong>
                            <span className="knowledge-category">{doc.category}</span>
                          </div>
                          <div className="row-actions">
                            <button type="button" onClick={() => startEditKnowledge(doc)}>
                              编辑
                            </button>
                            <button type="button" onClick={() => deleteKnowledgeDoc(doc.id)}>
                              删除
                            </button>
                          </div>
                        </div>
                        <p>{doc.content.slice(0, 200)}{doc.content.length > 200 ? "..." : ""}</p>
                        <small>
                          {doc.tags.join(" / ") || "无标签"} · 更新于{" "}
                          {new Date(doc.updatedAt).toLocaleString()}
                        </small>
                      </article>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="module-strip">
          <ModuleCard title="项目任务" text="项目、任务、看板入口已预留。" />
          <ModuleCard title="AI 智能问答" text="基于 LLM + RAG，支持知识库问答和对话。" />
          <ModuleCard title="文件资料" text="支持文件夹、权限、标签、小文件直传和版本记录。" />
          <ModuleCard title="会议通知" text="支持会议预约、站内通知和全局公告。" />
        </section>

        {selectedNotification ? (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => setSelectedNotification(null)}
          >
            <article
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="panel-head compact">
                <div>
                  <p className="eyebrow">{notificationTypeText(selectedNotification.type)}</p>
                  <h2 id="notification-detail-title">{selectedNotification.title}</h2>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                >
                  <XCircle size={18} />
                </button>
              </div>
              <p>{selectedNotification.content}</p>
              <small>{new Date(selectedNotification.createdAt).toLocaleString()}</small>
              <div className="row-actions">
                {!selectedNotification.readAt ? (
                  <button type="button" onClick={() => markNotificationRead(selectedNotification)}>
                    标记已读
                  </button>
                ) : (
                  <span className="pill approved">已读</span>
                )}
                <button type="button" onClick={() => setSelectedNotification(null)}>
                  关闭
                </button>
              </div>
            </article>
          </div>
        ) : null}
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
