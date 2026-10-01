-- Renombra "notes" a "contact" en InternalNote (sin pérdida de datos).
ALTER TABLE "InternalNote" RENAME COLUMN "notes" TO "contact";
