const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const applicationPreviewLimit = 8;
const accountPreviewLimit = 10;
const defaultResetPassword = "Student@123456";
const phonePattern = /^1[3-9]\d{9}$/;

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

// ── Auth ──────────────────────────────────────────────────

export async function apiLogin(username: string, password: string) {
  const response = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "登录失败");
  }
  return payload as { token: string; actor: { id: string; username: string; displayName: string; role: string; permissions: string[] } };
}

export async function apiLoadProfile(token: string) {
  const response = await fetch(`${apiBase}/auth/profile`, { headers: headers(token) });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "个人资料加载失败");
  }
  return payload;
}

export async function apiLoadUsers(token: string, search = "", includeInactive = false) {
  const response = await fetch(
    `${apiBase}/auth/users?search=${encodeURIComponent(search)}&includeInactive=${includeInactive}`,
    { headers: headers(token) }
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "账号列表加载失败");
  }
  return payload;
}

export async function apiCreateAccount(token: string, data: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/auth/register`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "账号创建失败");
  }
  return payload;
}

export async function apiUpdateProfile(token: string, data: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/auth/profile`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "更新失败");
  }
  return payload;
}

export async function apiResetPassword(token: string, userId: string) {
  const response = await fetch(`${apiBase}/auth/users/${userId}/reset-password`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ newPassword: defaultResetPassword })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "重置密码失败");
  }
  return payload;
}

export async function apiSetActive(token: string, userId: string, active: boolean) {
  const response = await fetch(`${apiBase}/auth/users/${userId}/set-active`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ active })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "状态更新失败");
  }
  return payload;
}

export async function apiSetRole(token: string, userId: string, role: string) {
  const response = await fetch(`${apiBase}/auth/users/${userId}/set-role`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ role })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "角色调整失败");
  }
  return payload;
}

// ── Inventory ─────────────────────────────────────────────

export async function apiLoadInventory(token: string) {
  const [summaryResponse, materialsResponse, applicationsResponse, movementsResponse] =
    await Promise.all([
      fetch(`${apiBase}/inventory/summary`, { headers: headers(token) }),
      fetch(`${apiBase}/inventory/materials`, { headers: headers(token) }),
      fetch(`${apiBase}/inventory/applications`, { headers: headers(token) }),
      fetch(`${apiBase}/inventory/stock-movements`, { headers: headers(token) })
    ]);

  if (
    !summaryResponse.ok ||
    !materialsResponse.ok ||
    !applicationsResponse.ok ||
    !movementsResponse.ok
  ) {
    throw new Error("数据加载失败，请确认 API 容器正在运行或重新登录。");
  }

  return {
    summary: await summaryResponse.json(),
    materials: await materialsResponse.json(),
    applications: await applicationsResponse.json(),
    stockMovements: await movementsResponse.json()
  };
}

export async function apiSubmitApplication(
  token: string,
  materialId: string,
  quantity: number,
  reason: string
) {
  const response = await fetch(`${apiBase}/inventory/applications`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ materialId, quantity, reason })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "申请提交失败");
  }
  return payload;
}

export async function apiStockIn(token: string, materialId: string, quantity: number) {
  const response = await fetch(`${apiBase}/inventory/materials/${materialId}/stock-in`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ quantity, remark: "管理员入库登记" })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "入库失败");
  }
  return payload;
}

export async function apiReviewApplication(
  token: string,
  id: string,
  action: "approve" | "reject"
) {
  const remark = action === "approve" ? "库存确认无误，批准领用。" : "请补充实验说明后重新提交。";
  const response = await fetch(`${apiBase}/inventory/applications/${id}/${action}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ remark })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "审批失败");
  }
  return payload;
}

// ── Files ─────────────────────────────────────────────────

export async function apiLoadFiles(token: string, search = "", parentId = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (parentId) params.set("parentId", parentId);
  const response = await fetch(`${apiBase}/files?${params.toString()}`, {
    headers: headers(token)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "文件资料加载失败");
  }
  return payload;
}

export async function apiLoadFileVersions(token: string, fileId: string) {
  const response = await fetch(`${apiBase}/files/${fileId}/versions`, {
    headers: headers(token)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "文件版本加载失败");
  }
  return payload;
}

export async function apiCreateFile(token: string, data: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/files`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "文件创建失败");
  }
  return payload;
}

export async function apiAddFileVersion(token: string, fileId: string, data: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/files/${fileId}/versions`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "版本新增失败");
  }
  return payload;
}

export async function apiDownloadFileVersion(token: string, fileId: string, versionId: string) {
  const response = await fetch(
    `${apiBase}/files/${fileId}/versions/${versionId}/download`,
    { headers: headers(token) }
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "文件下载失败");
  }
  return payload;
}

// ── Meetings & Notifications ──────────────────────────────

export async function apiLoadMeetings(token: string) {
  const response = await fetch(`${apiBase}/meetings`, { headers: headers(token) });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "会议列表加载失败");
  }
  return payload;
}

export async function apiLoadNotifications(token: string) {
  const response = await fetch(`${apiBase}/notifications`, { headers: headers(token) });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "通知加载失败");
  }
  return payload;
}

export async function apiCreateMeeting(token: string, data: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/meetings`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "会议创建失败");
  }
  return payload;
}

export async function apiCompleteMeeting(token: string, meetingId: string) {
  const response = await fetch(`${apiBase}/meetings/${meetingId}/complete`, {
    method: "PATCH",
    headers: headers(token)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "操作失败");
  }
  return payload;
}

export async function apiPublishAnnouncement(token: string, data: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/announcements`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "发布失败");
  }
  return payload;
}

export async function apiMarkNotificationRead(token: string, notificationId: string) {
  const response = await fetch(`${apiBase}/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: headers(token)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "操作失败");
  }
  return payload;
}

// ── AI ────────────────────────────────────────────────────

export async function apiSendChat(token: string, message: string, history: Array<{ role: string; content: string }>) {
  const response = await fetch(`${apiBase}/ai/chat`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ message, history })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "AI 响应失败");
  }
  return payload;
}

export async function apiLoadKnowledgeDocs(token: string) {
  const response = await fetch(`${apiBase}/ai/knowledge`, {
    headers: headers(token)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "知识库加载失败");
  }
  return payload;
}

export async function apiCreateKnowledgeDoc(token: string, data: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/ai/knowledge`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "知识文档创建失败");
  }
  return payload;
}

export async function apiUpdateKnowledgeDoc(token: string, docId: string, data: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/ai/knowledge/${docId}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "知识文档更新失败");
  }
  return payload;
}

export async function apiDeleteKnowledgeDoc(token: string, docId: string) {
  const response = await fetch(`${apiBase}/ai/knowledge/${docId}`, {
    method: "DELETE",
    headers: headers(token)
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error ?? "删除失败");
  }
}

export async function apiLoadFaqTemplates(token: string) {
  const response = await fetch(`${apiBase}/ai/faq`, {
    headers: headers(token)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "FAQ模板加载失败");
  }
  return payload;
}

export async function apiLoadChatHistory(token: string) {
  const response = await fetch(`${apiBase}/ai/chat-history`, {
    headers: headers(token)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "聊天记录加载失败");
  }
  return payload;
}

export async function apiUploadKnowledgeDoc(token: string, data: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/ai/knowledge/upload`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "文档上传失败");
  }
  return payload;
}

export async function apiReindexKnowledge(token: string) {
  const response = await fetch(`${apiBase}/ai/knowledge/reindex`, {
    method: "POST",
    headers: headers(token)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "重建索引失败");
  }
  return payload;
}

export async function apiSearchKnowledge(token: string, query: string) {
  const response = await fetch(
    `${apiBase}/ai/knowledge/search?query=${encodeURIComponent(query)}`,
    { headers: headers(token) }
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "搜索失败");
  }
  return payload;
}

export { apiBase, applicationPreviewLimit, accountPreviewLimit, phonePattern };
