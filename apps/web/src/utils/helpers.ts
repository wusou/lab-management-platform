import type {
  ApplicationStatus,
  FileCategory,
  FileVisibility,
  MeetingStatus,
  NotificationType,
  Permission,
  Role
} from "../types";

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
export const applicationPreviewLimit = 8;
export const accountPreviewLimit = 10;
export const defaultResetPassword = "Student@123456";
export const phonePattern = /^1[3-9]\d{9}$/;

export function toDatetimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function statusText(status: ApplicationStatus) {
  return {
    pending: "待审批",
    approved: "已批准",
    rejected: "已拒绝"
  }[status];
}

export function roleText(role: Role) {
  return {
    super_admin: "超级管理员",
    admin: "管理员",
    member: "成员"
  }[role];
}

export function fileCategoryText(category: FileCategory) {
  return {
    sop: "SOP",
    template: "模板",
    record: "记录",
    dataset: "数据集",
    meeting: "会议",
    other: "其他"
  }[category];
}

export function visibilityText(visibility: FileVisibility) {
  return {
    public: "公开",
    group: "课题组可见",
    private: "仅自己可见"
  }[visibility];
}

export function meetingStatusText(status: MeetingStatus) {
  return {
    scheduled: "已预约",
    completed: "已完成",
    cancelled: "已取消"
  }[status];
}

export function notificationTypeText(type: NotificationType) {
  return {
    announcement: "公告",
    meeting: "会议",
    approval: "审批",
    task: "任务",
    system: "系统"
  }[type];
}

export function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) {
    return "-";
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.ceil(sizeBytes / 1024)} KB`;
  }
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

export const permissionLabels: Record<Permission, string> = {
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

export const rolePermissions: Record<Role, Permission[]> = {
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
