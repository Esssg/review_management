import type { OrderWithRelations } from "@/types/orders";

export type HomeOrderCounts = {
  total: number | null;
  pending: number | null;
  completed: number | null;
};

export type HomeInitialData = {
  user: {
    id: string;
    email: string;
  };
  orderCounts: HomeOrderCounts;
  pendingOrders: OrderWithRelations[];
};
