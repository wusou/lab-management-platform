import type { InventoryApplicationRequestedPayload } from "@lab/contracts";
import type { PluginManifest } from "@lab/core";
import { createDomainEvent } from "@lab/core";
import { randomUUID } from "node:crypto";

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

interface InventoryApplicationRequest {
  materialId: string;
  quantity: number;
  reason?: string;
}

interface ReviewRequest {
  remark?: string;
}

const materials: Material[] = [
  {
    id: "m-001",
    name: "一次性丁腈手套",
    spec: "M 码 / 100 只",
    stock: 18,
    warnStock: 10,
    unit: "盒",
    location: "A-01 安全柜",
    manager: "李老师"
  },
  {
    id: "m-002",
    name: "移液枪枪头",
    spec: "10uL / 无菌盒装",
    stock: 7,
    warnStock: 12,
    unit: "盒",
    location: "B-03 试剂架",
    manager: "王同学"
  },
  {
    id: "m-003",
    name: "离心管",
    spec: "1.5mL / 500 支",
    stock: 26,
    warnStock: 8,
    unit: "包",
    location: "B-01 耗材柜",
    manager: "王同学"
  },
  {
    id: "m-004",
    name: "无水乙醇",
    spec: "AR 500mL",
    stock: 5,
    warnStock: 6,
    unit: "瓶",
    location: "C-02 危化柜",
    manager: "李老师"
  }
];

const applications: InventoryApplication[] = [
  {
    id: "a-1001",
    materialId: "m-002",
    materialName: "移液枪枪头",
    applicantId: "demo-member",
    applicantName: "成员 demo-member",
    quantity: 2,
    reason: "细胞培养实验补充耗材",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  }
];

function getStats() {
  return {
    materialCount: materials.length,
    lowStockCount: materials.filter((material) => material.stock <= material.warnStock).length,
    pendingApplications: applications.filter((application) => application.status === "pending")
      .length,
    approvedApplications: applications.filter((application) => application.status === "approved")
      .length
  };
}

function getMaterialOrError(materialId: string) {
  return materials.find((material) => material.id === materialId);
}

export const inventoryPlugin: PluginManifest = {
  name: "inventory",
  version: "0.1.0",
  description: "耗材与实验室设备申请模块 MVP",
  capabilities: ["inventory:materials", "inventory:application-request", "inventory:approval"],
  routes: [
    {
      method: "GET",
      path: "/inventory/summary",
      permission: "inventory:read",
      summary: "获取耗材管理统计"
    },
    {
      method: "GET",
      path: "/inventory/materials",
      permission: "inventory:read",
      summary: "获取耗材列表"
    },
    {
      method: "GET",
      path: "/inventory/applications",
      permission: "inventory:read",
      summary: "获取耗材申请列表"
    },
    {
      method: "POST",
      path: "/inventory/applications",
      permission: "inventory:read",
      summary: "成员提交耗材或设备申请"
    },
    {
      method: "PATCH",
      path: "/inventory/applications/:id/approve",
      permission: "inventory:write",
      summary: "管理员批准耗材申请"
    },
    {
      method: "PATCH",
      path: "/inventory/applications/:id/reject",
      permission: "inventory:write",
      summary: "管理员拒绝耗材申请"
    }
  ],
  eventsPublished: [
    "inventory.application.requested",
    "inventory.application.approved",
    "inventory.application.rejected"
  ],
  eventsSubscribed: [],
  async activate(context) {
    return {
      name: "inventory",
      routes: [
        {
          method: "GET",
          path: "/inventory/summary",
          permission: "inventory:read",
          summary: "获取耗材管理统计",
          handler: () => ({ body: getStats() })
        },
        {
          method: "GET",
          path: "/inventory/materials",
          permission: "inventory:read",
          summary: "获取耗材列表",
          handler: () => ({ body: materials })
        },
        {
          method: "GET",
          path: "/inventory/applications",
          permission: "inventory:read",
          summary: "获取耗材申请列表",
          handler: () => ({
            body: [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          })
        },
        {
          method: "POST",
          path: "/inventory/applications",
          permission: "inventory:read",
          summary: "成员提交耗材或设备申请",
          handler: async ({ actor, body }) => {
            if (!actor) {
              return { status: 401, body: { error: "Unauthorized" } };
            }

            const request = body as Partial<InventoryApplicationRequest>;
            if (!request.materialId || !request.quantity || request.quantity <= 0) {
              return {
                status: 400,
                body: { error: "materialId and positive quantity are required" }
              };
            }

            const material = getMaterialOrError(request.materialId);
            if (!material) {
              return { status: 404, body: { error: "Material not found" } };
            }

            if (request.quantity > material.stock) {
              return { status: 409, body: { error: "Requested quantity exceeds stock" } };
            }

            const applicationId = randomUUID();
            const application: InventoryApplication = {
              id: applicationId,
              materialId: material.id,
              materialName: material.name,
              applicantId: actor.id,
              applicantName: `成员 ${actor.id}`,
              quantity: request.quantity,
              reason: request.reason?.trim() || "未填写",
              status: "pending",
              createdAt: new Date().toISOString()
            };
            applications.unshift(application);

            const payload: InventoryApplicationRequestedPayload = {
              applicationId,
              materialId: material.id,
              applicantId: actor.id,
              quantity: request.quantity
            };

            await context.eventBus.publish(
              createDomainEvent("inventory", "inventory.application.requested", payload)
            );

            await context.audit.record({
              actorId: actor.id,
              action: "inventory.application.requested",
              targetType: "inventory_application",
              targetId: applicationId,
              occurredAt: new Date().toISOString(),
              metadata: {
                materialId: material.id,
                quantity: request.quantity
              }
            });

            return {
              status: 201,
              body: application
            };
          }
        },
        {
          method: "PATCH",
          path: "/inventory/applications/:id/approve",
          permission: "inventory:write",
          summary: "管理员批准耗材申请",
          handler: async ({ actor, params, body }) => {
            if (!actor) {
              return { status: 401, body: { error: "Unauthorized" } };
            }

            const application = applications.find((item) => item.id === params.id);
            if (!application) {
              return { status: 404, body: { error: "Application not found" } };
            }
            if (application.status !== "pending") {
              return { status: 409, body: { error: "Application already reviewed" } };
            }

            const material = getMaterialOrError(application.materialId);
            if (!material) {
              return { status: 404, body: { error: "Material not found" } };
            }
            if (application.quantity > material.stock) {
              return { status: 409, body: { error: "Insufficient stock" } };
            }

            const review = body as Partial<ReviewRequest>;
            material.stock -= application.quantity;
            application.status = "approved";
            application.reviewedAt = new Date().toISOString();
            application.reviewRemark = review.remark?.trim() || "审批通过";

            await context.eventBus.publish(
              createDomainEvent("inventory", "inventory.application.approved", {
                applicationId: application.id,
                materialId: material.id,
                quantity: application.quantity,
                reviewerId: actor.id
              })
            );

            return { body: application };
          }
        },
        {
          method: "PATCH",
          path: "/inventory/applications/:id/reject",
          permission: "inventory:write",
          summary: "管理员拒绝耗材申请",
          handler: async ({ actor, params, body }) => {
            if (!actor) {
              return { status: 401, body: { error: "Unauthorized" } };
            }

            const application = applications.find((item) => item.id === params.id);
            if (!application) {
              return { status: 404, body: { error: "Application not found" } };
            }
            if (application.status !== "pending") {
              return { status: 409, body: { error: "Application already reviewed" } };
            }

            const review = body as Partial<ReviewRequest>;
            application.status = "rejected";
            application.reviewedAt = new Date().toISOString();
            application.reviewRemark = review.remark?.trim() || "审批拒绝";

            await context.eventBus.publish(
              createDomainEvent("inventory", "inventory.application.rejected", {
                applicationId: application.id,
                reviewerId: actor.id
              })
            );

            return { body: application };
          }
        }
      ]
    };
  }
};
