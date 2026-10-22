-- Phase 06: Facebook Page and Instagram professional account connections. Additive only.

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('FACEBOOK', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "SocialConnectionStatus" AS ENUM ('CONNECTED', 'NEEDS_RECONNECT');

-- CreateTable
CREATE TABLE "social_connections" (
    "id" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "accountId" TEXT NOT NULL,
    "authorizedUserId" TEXT,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "accountType" TEXT,
    "grantedScopes" TEXT[],
    "encryptedToken" TEXT,
    "tokenExpiresAt" TIMESTAMPTZ(3),
    "dataAccessExpiresAt" TIMESTAMPTZ(3),
    "tokenIssuedAt" TIMESTAMPTZ(3) NOT NULL,
    "problem" TEXT,
    "lastCheckedAt" TIMESTAMPTZ(3),
    "connectedById" TEXT,
    "connectedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_oauth_states" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT,
    "provider" "SocialProvider" NOT NULL,
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "encryptedPending" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_connections_provider_key" ON "social_connections"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "social_oauth_states_stateHash_key" ON "social_oauth_states"("stateHash");

-- CreateIndex
CREATE INDEX "social_oauth_states_userId_idx" ON "social_oauth_states"("userId");

-- AddForeignKey
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_oauth_states" ADD CONSTRAINT "social_oauth_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written constraints.
-- A working connection always has a token; one that needs reconnecting has had it erased.
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_token_status" CHECK (("status" = 'CONNECTED') = ("encryptedToken" IS NOT NULL));
-- A row is either an unused state or a pending Page choice, never both.
ALTER TABLE "social_oauth_states" ADD CONSTRAINT "social_oauth_states_kind" CHECK (("stateHash" IS NULL) <> ("encryptedPending" IS NULL));
