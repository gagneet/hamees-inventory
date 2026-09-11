-- Payment reminders used to reuse REORDER_REMINDER (with relatedType 'order'); move them to their
-- own type so REORDER_REMINDER can mean a stock reorder. Separate from the migration that added
-- the enum value because Postgres cannot use a new enum value in the transaction that adds it.
UPDATE "Alert" SET "type" = 'PAYMENT_REMINDER' WHERE "type" = 'REORDER_REMINDER' AND "relatedType" = 'order';
