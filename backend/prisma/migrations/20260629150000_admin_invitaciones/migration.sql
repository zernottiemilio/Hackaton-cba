-- CreateTable
CREATE TABLE "tokens_invitacion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_invitacion_token_key" ON "tokens_invitacion"("token");

-- CreateIndex
CREATE INDEX "tokens_invitacion_usuario_id_idx" ON "tokens_invitacion"("usuario_id");

-- AddForeignKey
ALTER TABLE "tokens_invitacion" ADD CONSTRAINT "tokens_invitacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
