import type {
  UserRole,
  OrderStatus,
  StockMovementType,
  OrderPriority,
  BodyType,
  ClothInventory,
  OrderItem,
  Order,
} from '@prisma/client';

export type {
  UserRole,
  OrderStatus,
  StockMovementType,
  OrderPriority,
  BodyType,
  ClothInventory,
  OrderItem,
  Order,
};

export type InventoryType = "cloth" | "accessory";
