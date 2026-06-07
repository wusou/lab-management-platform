import { useCallback, useMemo, useState } from "react";
import type {
  Actor,
  ChatHistoryRecord,
  ChatMessage,
  FaqTemplate,
  FileVersion,
  InventoryApplication,
  KnowledgeDocument,
  KnowledgeSource,
  LabFile,
  ManagedUser,
  Material,
  Meeting,
  NotificationItem,
  StockMovement,
  Summary
} from "../types";
import * as api from "../utils/api";
import { clearAuth, getStoredActor, getStoredToken, saveAuth } from "../utils/auth";
import { toDatetimeLocal } from "../utils/helpers";

export function useAppData() {
  const [token, setToken] = useState(() => getStoredToken());
  const [actor, setActor] = useState<Actor | null>(() => getStoredActor());
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
  const [loading, setLoading] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerStudentId, setRegisterStudentId] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerRole, setRegisterRole] = useState<"admin" | "member">("member");
  const [accountTab, setAccountTab] = useState<"profile" | "security" | "list" | "roles" | "register">("profile");
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
  const [fileCategory, setFileCategory] = useState<import("../types").FileCategory>("template");
  const [fileNodeType, setFileNodeType] = useState<import("../types").FileNodeType>("file");
  const [fileVisibility, setFileVisibility] = useState<import("../types").FileVisibility>("public");
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
  const [chatHistory, setChatHistory] = useState<ChatHistoryRecord[]>([]);

  const canApprove = actor?.permissions.includes("inventory:write") ?? false;
  const canManageUsers = actor?.permissions.includes("user:write") ?? false;
  const canManageFiles = actor?.permissions.includes("file:write") ?? false;
  const canManageMeetings = actor?.permissions.includes("meeting:write") ?? false;

  // Login
  const login = useCallback(async (user: string, pass: string) => {
    const result = await api.apiLogin(user, pass);
    setToken(result.token);
    setActor(result.actor as Actor);
    saveAuth(result.token, result.actor as Actor);
    return result;
  }, []);

  const logout = useCallback(() => {
    setToken("");
    setActor(null);
    clearAuth();
  }, []);

  // Data loaders
  const loadInventory = useCallback(async (t: string) => {
    const data = await api.apiLoadInventory(t);
    setSummary(data.summary);
    setMaterials(data.materials);
    setApplications(data.applications);
    setStockMovements(data.stockMovements);
  }, []);

  const loadProfile = useCallback(async (t: string) => {
    const p = await api.apiLoadProfile(t);
    setProfile(p);
    setContactPhone(p.phone ?? "");
  }, []);

  const loadUsersFn = useCallback(async (t: string, search = "", includeInactive = false) => {
    const u = await api.apiLoadUsers(t, search, includeInactive);
    setUsers(u);
  }, []);

  const loadFiles = useCallback(async (t: string, search = "", parentId = "") => {
    const f = await api.apiLoadFiles(t, search, parentId);
    setFiles(f);
  }, []);

  const loadFileVersions = useCallback(async (t: string, fileId: string) => {
    if (!fileId) {
      setFileVersions([]);
      return;
    }
    const v = await api.apiLoadFileVersions(t, fileId);
    setFileVersions(v);
  }, []);

  const loadMeetings = useCallback(async (t: string) => {
    const m = await api.apiLoadMeetings(t);
    setMeetings(m);
  }, []);

  const loadNotifications = useCallback(async (t: string) => {
    const n = await api.apiLoadNotifications(t);
    setNotifications(n);
  }, []);

  const loadKnowledgeDocs = useCallback(async (t: string) => {
    const docs = await api.apiLoadKnowledgeDocs(t);
    setKnowledgeDocs(docs);
  }, []);

  const loadFaqTemplates = useCallback(async (t: string) => {
    const faqs = await api.apiLoadFaqTemplates(t);
    setFaqTemplates(faqs);
  }, []);

  const loadChatHistory = useCallback(async (t: string) => {
    const h = await api.apiLoadChatHistory(t);
    setChatHistory(h);
  }, []);

  // Derived data
  const pendingApplications = useMemo(
    () => applications.filter((app) => app.status === "pending"),
    [applications]
  );

  const visibleApplications = useMemo(
    () =>
      canApprove
        ? applications
        : applications.filter((app) => app.applicantId === actor?.id),
    [applications, canApprove, actor]
  );

  const displayedApplications = useMemo(
    () =>
      showAllApplications
        ? visibleApplications
        : visibleApplications.slice(0, api.applicationPreviewLimit),
    [visibleApplications, showAllApplications]
  );

  const hasMoreApplications = visibleApplications.length > api.applicationPreviewLimit;

  const displayedUsers = useMemo(
    () => (showAllAccounts ? users : users.slice(0, api.accountPreviewLimit)),
    [users, showAllAccounts]
  );

  const hasMoreUsers = users.length > api.accountPreviewLimit;

  const filteredStockMovements = useMemo(
    () =>
      stockMovements.filter((m) => {
        const matchesMaterial =
          movementMaterialFilter === "all" || m.materialId === movementMaterialFilter;
        const matchesType = movementTypeFilter === "all" || m.type === movementTypeFilter;
        return matchesMaterial && matchesType;
      }),
    [stockMovements, movementMaterialFilter, movementTypeFilter]
  );

  const currentFolders = useMemo(
    () => files.filter((f) => f.nodeType === "folder" && (f.parentId ?? "") === fileParentId),
    [files, fileParentId]
  );

  const currentFileItems = useMemo(
    () => files.filter((f) => f.nodeType === "file" && (f.parentId ?? "") === fileParentId),
    [files, fileParentId]
  );

  const selectedFile = useMemo(
    () => files.find((f) => f.id === selectedFileId),
    [files, selectedFileId]
  );

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId),
    [materials, selectedMaterialId]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.readAt),
    [notifications]
  );

  return {
    // Auth
    token, setToken, actor, setActor,
    username, setUsername, password, setPassword,
    login, logout,
    message, setMessage, loading, setLoading,
    // Inventory
    materials, setMaterials, applications, setApplications,
    stockMovements, setStockMovements, summary, setSummary,
    selectedMaterialId, setSelectedMaterialId,
    quantity, setQuantity, stockInQuantity, setStockInQuantity,
    reason, setReason,
    loadInventory,
    // Files
    files, setFiles, fileVersions, setFileVersions,
    fileSearch, setFileSearch, fileParentId, setFileParentId,
    selectedFileId, setSelectedFileId,
    fileTitle, setFileTitle, fileCategory, setFileCategory,
    fileNodeType, setFileNodeType, fileVisibility, setFileVisibility,
    fileTags, setFileTags, fileDriveUrl, setFileDriveUrl,
    fileDescription, setFileDescription,
    fileUploadName, setFileUploadName, fileUploadMimeType, setFileUploadMimeType,
    fileUploadSize, setFileUploadSize, fileUploadBase64, setFileUploadBase64,
    versionNote, setVersionNote,
    loadFiles, loadFileVersions,
    // Meetings
    meetings, setMeetings,
    meetingTitle, setMeetingTitle, meetingStartsAt, setMeetingStartsAt,
    meetingEndsAt, setMeetingEndsAt, meetingLocation, setMeetingLocation,
    meetingOnlineUrl, setMeetingOnlineUrl, meetingParticipants, setMeetingParticipants,
    meetingSummary, setMeetingSummary,
    announcementTitle, setAnnouncementTitle, announcementContent, setAnnouncementContent,
    selectedNotification, setSelectedNotification,
    notifications, setNotifications,
    loadMeetings, loadNotifications,
    // Accounts
    users, setUsers, profile, setProfile,
    accountTab, setAccountTab,
    userSearch, setUserSearch,
    contactPhone, setContactPhone,
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword, confirmPassword, setConfirmPassword,
    registerUsername, setRegisterUsername, registerPassword, setRegisterPassword,
    registerStudentId, setRegisterStudentId, registerDisplayName, setRegisterDisplayName,
    registerRole, setRegisterRole,
    loadProfile, loadUsersFn,
    // AI
    aiMessage, setAiMessage, aiChatMessages, setAiChatMessages,
    aiLoading, setAiLoading, aiError, setAiError, aiSources, setAiSources,
    knowledgeDocs, setKnowledgeDocs, faqTemplates, setFaqTemplates,
    knowledgeTitle, setKnowledgeTitle, knowledgeContent, setKnowledgeContent,
    knowledgeCategory, setKnowledgeCategory, knowledgeTags, setKnowledgeTags,
    editingKnowledgeId, setEditingKnowledgeId,
    showKnowledgePanel, setShowKnowledgePanel,
    aiActiveTab, setAiActiveTab,
    chatHistory, setChatHistory,
    loadKnowledgeDocs, loadFaqTemplates, loadChatHistory,
    // Permissions
    canApprove, canManageUsers, canManageFiles, canManageMeetings,
    // Derived
    pendingApplications, visibleApplications, displayedApplications,
    hasMoreApplications,
    displayedUsers, hasMoreUsers,
    filteredStockMovements,
    currentFolders, currentFileItems, selectedFile,
    selectedMaterial, unreadNotifications,
    showAllApplications, setShowAllApplications,
    showAllAccounts, setShowAllAccounts,
    showInactiveAccounts, setShowInactiveAccounts,
    movementMaterialFilter, setMovementMaterialFilter,
    movementTypeFilter, setMovementTypeFilter,
  };
}
