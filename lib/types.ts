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
};

export type InventoryType = "cloth" | "accessory";
