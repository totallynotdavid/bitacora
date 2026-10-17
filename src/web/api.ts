import type {
  Board,
  Card,
  DoneWeek,
  IssuedLink,
  Label,
  ListId,
  Member,
  Role,
  Settings,
} from "../shared/model";
import type { CreateLabel, UpdateCard, UpdateLabel } from "../shared/schemas";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, method = "GET", json?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (json !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(json);
  }
  const res = await fetch(path, init);
  if (res.status === 401) {
    location.assign("/login");
    throw new Error("Sesión vencida");
  }
  if (!res.ok) throw new ApiError(`${method} ${path}: ${res.status}`, res.status);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export type Placement = { list: ListId; doneDate?: string };

export const api = {
  board: () => request<Board>("/api/board"),
  doneWeek: (week: string) => request<DoneWeek>(`/api/done?week=${week}`),
  card: (id: string) => request<Card>(`/api/cards/${id}`),
  create: (card: { id: string; title: string; list: ListId }) => request<Card>("/api/cards", "POST", card),
  update: (id: string, patch: UpdateCard) => request<Card>(`/api/cards/${id}`, "PATCH", patch),
  move: (id: string, placement: Placement, index: number) =>
    request<Card>(`/api/cards/${id}/move`, "POST", { ...placement, index }),
  remove: (id: string) => request<void>(`/api/cards/${id}`, "DELETE"),
  createLabel: (label: CreateLabel) => request<Label>("/api/labels", "POST", label),
  updateLabel: (id: string, patch: UpdateLabel) => request<Label>(`/api/labels/${id}`, "PATCH", patch),
  removeLabel: (id: string) => request<void>(`/api/labels/${id}`, "DELETE"),
  settings: () => request<Settings>("/api/settings"),
  rename: (name: string) => request<Settings>("/api/settings", "PATCH", { name }),
  changePassword: (current: string, password: string) =>
    request<void>("/api/settings/password", "POST", { current, password }),
  regenerateToken: () => request<Settings>("/api/settings/report-token", "POST"),
  members: () => request<Member[]>("/api/members"),
  invite: (role: Role) => request<IssuedLink>("/api/members/invites", "POST", { role }),
  resetLink: (id: string) => request<IssuedLink>(`/api/members/${id}/reset-link`, "POST"),
  updateMember: (id: string, patch: { role?: Role; disabled?: boolean }) =>
    request<Member>(`/api/members/${id}`, "PATCH", patch),
};

/** Sends a delete that the browser finishes even after the page is gone. */
export function removeOnExit(id: string): void {
  void fetch(`/api/cards/${id}`, { method: "DELETE", keepalive: true });
}
