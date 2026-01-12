-- Transfer ownership of all tables to hamees_user
ALTER TABLE "AccessoryInventory" OWNER TO hamees_user;
ALTER TABLE "Alert" OWNER TO hamees_user;
ALTER TABLE "ClothInventory" OWNER TO hamees_user;
ALTER TABLE "Customer" OWNER TO hamees_user;
ALTER TABLE "GarmentAccessory" OWNER TO hamees_user;
ALTER TABLE "GarmentPattern" OWNER TO hamees_user;
ALTER TABLE "Measurement" OWNER TO hamees_user;
ALTER TABLE "Order" OWNER TO hamees_user;
ALTER TABLE "OrderItem" OWNER TO hamees_user;
ALTER TABLE "POItem" OWNER TO hamees_user;
ALTER TABLE "PurchaseOrder" OWNER TO hamees_user;
ALTER TABLE "Settings" OWNER TO hamees_user;
ALTER TABLE "StockMovement" OWNER TO hamees_user;
ALTER TABLE "Supplier" OWNER TO hamees_user;
ALTER TABLE "SupplierPrice" OWNER TO hamees_user;
ALTER TABLE "User" OWNER TO hamees_user;

-- Transfer sequence ownership as well
ALTER SEQUENCE "AccessoryInventory_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "Alert_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "ClothInventory_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "Customer_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "GarmentAccessory_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "GarmentPattern_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "Measurement_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "Order_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "OrderItem_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "POItem_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "PurchaseOrder_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "Settings_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "StockMovement_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "Supplier_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "SupplierPrice_id_seq" OWNER TO hamees_user;
ALTER SEQUENCE "User_id_seq" OWNER TO hamees_user;

-- Also transfer schema ownership
ALTER SCHEMA public OWNER TO hamees_user;
