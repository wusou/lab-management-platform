import { FlaskConical } from "lucide-react";

interface LoginFormProps {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
  message: string;
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
}

export function LoginForm({ username, setUsername, password, setPassword, loading, message, onSubmit }: LoginFormProps) {
  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={onSubmit} autoComplete="off">
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
