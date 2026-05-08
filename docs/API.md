# API 文档

完整 OpenAPI 文件在：

```text
packages/contracts/openapi/core-api.yaml
```

本文件提供开发时最常用的接口说明和调用示例。

## 1. 基础地址

开发环境：

```text
http://localhost:3000
```

生产环境经 Nginx 反代：

```text
https://你的域名/api
```

## 2. 认证方式

登录：

```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@123456"
}
```

返回：

```json
{
  "token": "session-token",
  "actor": {
    "id": "u-admin",
    "username": "admin",
    "displayName": "实验室管理员",
    "role": "admin",
    "permissions": []
  }
}
```

后续请求加请求头：

```http
Authorization: Bearer session-token
```

## 3. 核心接口

健康检查：

```http
GET /health
```

当前用户：

```http
GET /auth/profile
Authorization: Bearer <token>
```

修改手机号：

```http
PATCH /auth/profile/contact
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "13800000000"
}
```

修改密码：

```http
PATCH /auth/profile/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "OldPassword",
  "newPassword": "NewPassword123"
}
```

## 4. 账号管理

查询账号，默认只返回启用账号：

```http
GET /auth/users?search=student
Authorization: Bearer <token>
```

显示停用账号：

```http
GET /auth/users?search=student&includeInactive=true
Authorization: Bearer <token>
```

创建账号：

```http
POST /auth/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "student002",
  "password": "Student@123456",
  "studentId": "S000002",
  "displayName": "学生二号",
  "role": "member"
}
```

重置学员密码：

```http
PATCH /auth/users/{id}/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "newPassword": "Student@123456"
}
```

调整角色：

```http
PATCH /auth/users/{id}/role
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "admin"
}
```

停用学员：

```http
DELETE /auth/users/{id}
Authorization: Bearer <token>
```

## 5. 耗材库存

库存统计：

```http
GET /inventory/summary
Authorization: Bearer <token>
```

耗材列表：

```http
GET /inventory/materials
Authorization: Bearer <token>
```

提交申请：

```http
POST /inventory/applications
Authorization: Bearer <token>
Content-Type: application/json

{
  "materialId": "m-001",
  "quantity": 1,
  "reason": "课题实验耗材申请"
}
```

批准申请：

```http
PATCH /inventory/applications/{id}/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "remark": "库存确认无误，批准领用。"
}
```

拒绝申请：

```http
PATCH /inventory/applications/{id}/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "remark": "请补充实验说明后重新提交。"
}
```

入库：

```http
PATCH /inventory/materials/m-001/stock-in
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 5,
  "remark": "管理员入库登记"
}
```

库存流水：

```http
GET /inventory/stock-movements
Authorization: Bearer <token>
```

## 6. 文件资料

查询文件资料：

```http
GET /files?search=sop
Authorization: Bearer <token>
```

登记 Synology Drive 链接：

```http
POST /files
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "实验记录模板",
  "category": "template",
  "driveUrl": "https://drive.example.local/shared/template",
  "description": "Synology Drive 共享链接"
}
```

## 7. 实时事件

前端通过 SSE 订阅：

```text
GET /events?token=<token>
```

当前用于申请提交、审批变化后的页面自动刷新。
