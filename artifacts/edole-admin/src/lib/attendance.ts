import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type AttendanceSession = {
  id: string;
  organizationId: string;
  collaboratorId: string;
  userId: string | null;
  departmentId: string | null;
  projectId: string | null;
  workDate: string;
  status: "open" | "closed" | "abandoned";
  clockInAt: string | null;
  clockOutAt: string | null;
  totalMinutes: number;
  breakMinutes: number;
  effectiveMinutes: number;
  isLate: boolean;
  isEarlyLeave: boolean;
  collaboratorName?: string;
  departmentName?: string | null;
};

export type AttendanceRecord = {
  id: string;
  sessionId: string | null;
  collaboratorId: string;
  kind: "clock_in" | "clock_out" | "break_start" | "break_end";
  occurredAt: string;
  latitude: string | null;
  longitude: string | null;
  accuracyMeters: number | null;
  locationLabel: string | null;
  sourceDevice: string | null;
  comment: string | null;
  status: string;
  source: string | null;
  kioskId: string | null;
  photoUrl: string | null;
};

export type AttendanceFlag = {
  id: string;
  collaboratorId: string;
  collaboratorName?: string;
  sessionId: string | null;
  kind: string;
  severity: "low" | "medium" | "high";
  workDate: string | null;
  description: string | null;
  isResolved: boolean;
  createdAt: string;
};

export function useMyAttendanceToday() {
  return useQuery<{ session: AttendanceSession | null; records: AttendanceRecord[]; collaborator: { id: string; departmentId: string | null } | null }>({
    queryKey: ["attendance", "me", "today"],
    queryFn: () => apiFetch("/api/attendance/me/today"),
    refetchInterval: 60_000,
  });
}

export function useMyAttendanceHistory(limit = 30) {
  return useQuery<{ data: AttendanceSession[] }>({
    queryKey: ["attendance", "me", "history", limit],
    queryFn: () => apiFetch(`/api/attendance/me/history?limit=${limit}`),
  });
}

export function useAttendanceDashboard(date?: string) {
  const qs = date ? `?date=${date}` : "";
  return useQuery<{
    date: string;
    summary: { total: number; present: number; late: number; onBreak: number; closed: number; totalHours: number };
    sessions: AttendanceSession[];
  }>({
    queryKey: ["attendance", "dashboard", date ?? "today"],
    queryFn: () => apiFetch(`/api/attendance/dashboard${qs}`),
    refetchInterval: 60_000,
  });
}

export function useAttendanceAnomalies(resolved = false) {
  return useQuery<{ data: AttendanceFlag[] }>({
    queryKey: ["attendance", "anomalies", resolved],
    queryFn: () => apiFetch(`/api/attendance/anomalies?resolved=${resolved}`),
  });
}

type ClockKind = "clock_in" | "clock_out" | "break_start" | "break_end";

export function useClockMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: ClockKind;
      latitude?: number; longitude?: number; accuracyMeters?: number;
      locationLabel?: string; comment?: string; projectId?: string;
    }) => {
      const endpoint = `/api/attendance/${input.kind.replace("_", "-")}`;
      const { kind: _omit, ...payload } = input;
      void _omit;
      return apiFetch<{ session: AttendanceSession; record: AttendanceRecord }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ ...payload, sourceDevice: navigator.userAgent.slice(0, 200) }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useResolveAttendanceFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/attendance/anomalies/${id}/resolve`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", "anomalies"] }),
  });
}

export async function captureGeolocation(): Promise<{ latitude: number; longitude: number; accuracyMeters: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: Math.round(pos.coords.accuracy),
        });
      },
      () => { clearTimeout(timeout); resolve(null); },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30_000 },
    );
  });
}

export function formatMinutes(m: number | null | undefined): string {
  if (!m || m <= 0) return "0h00";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h${String(mm).padStart(2, "0")}`;
}
