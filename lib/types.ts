import {
  UserRole,
  OrderStatus,
  StockMovementType,
  OrderPriority,
  BodyType,
} from '@prisma/client';
import type {
  ClothInventory,
  OrderItem,
  Order,
  Alert,
} from '@prisma/client';

export {
  UserRole,
  OrderStatus,
  StockMovementType,
  OrderPriority,
  BodyType,
};

export type {
  ClothInventory,
  OrderItem,
  Order,
  Alert,
};

export type InventoryType = "cloth" | "accessory";

export type DashboardStats = {
  revenue: {
    byMonth: {
      month: string;
      revenue: number;
    }[];
  };
  charts: {
    ordersByStatus: {
      status: OrderStatus;
      count: number;
    }[];
    topFabrics: {
      id: string;
      name: string;
      type: string;
      color: string;
      metersUsed: number;
    }[];
  };
  inventory: {
    lowStock: number;
    criticalStock: number;
    totalValue: number;
    totalItems: number;
    totalMeters: number;
  };
  alerts: {
    recent: Alert[];
  };
};
