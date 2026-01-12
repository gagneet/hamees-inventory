import {
  UserRole,
  OrderStatus,
  StockMovementType,
  OrderPriority,
  BodyType,
  AlertType,
  AlertSeverity,
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
  AlertType,
  AlertSeverity,
};

export type {
  ClothInventory,
  OrderItem,
  Order,
  Alert,
};

export type InventoryType = "cloth" | "accessory";
