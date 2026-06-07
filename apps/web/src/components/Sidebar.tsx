import {
  Bot,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileText,
  FlaskConical,
  LayoutDashboard,
  PackageCheck,
  Users
} from "lucide-react";
import { roleText } from "../utils/helpers";
import type { Actor } from "../types";

interface SidebarProps {
  actor: Actor;
}

export function Sidebar({ actor }: SidebarProps) {
  return (
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
  );
}
