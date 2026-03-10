export type McpTransport = "stdio" | "http";

export interface McpServerConfig {
  /** 唯一标识 */
  name: string;
  /** 传输协议 */
  transport: McpTransport;
  /** stdio: 启动命令 */
  command?: string;
  /** stdio: 命令参数 */
  args?: string[];
  /** stdio: 环境变量 */
  env?: Record<string, string>;
  /** http: 服务器 URL */
  url?: string;
  /** http: 请求头（如 Authorization） */
  headers?: Record<string, string>;
  /** 是否启用 */
  enabled?: boolean;
}

export interface McpConfig {
  /** 是否启用 MCP 集成 */
  enabled: boolean;
  /** MCP 服务器配置文件路径 */
  configPath?: string;
}
