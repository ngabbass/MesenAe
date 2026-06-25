import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";

export function GlobalAdminNotifier() {
  useRealtimeOrders();
  return null;
}
