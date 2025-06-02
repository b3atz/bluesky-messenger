// backend/src/utils/bluesky-client.ts
import { NodeOAuthClient, type NodeSavedState, type NodeSavedSession } from "@atproto/oauth-client-node";
import type { Key } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { env } from "process";

// In‐memory maps now explicitly typed:
const stateMap = new Map<string, NodeSavedState>();
const sessionMap = new Map<string, NodeSavedSession>();

let clientInstance: NodeOAuthClient | null = null;

export async function getBlueskyClient() {
  if (clientInstance) return clientInstance;

  const publicUrl = env.PUBLIC_URL;
  const url = publicUrl || `http://127.0.0.1:${env.PORT}`;
  const enc = encodeURIComponent;
  // Import your private key and cast to Key (as shown before):
  const rawKey1 = await JoseKey.fromImportable(process.env.PRIVATE_KEY_1!);
  // “Key” is the interface that NodeOAuthClient expects:
  const key1 = rawKey1 as unknown as Key;

  clientInstance = new NodeOAuthClient({
    clientMetadata: {
      client_name: "Bluesky Messagner",
      client_id: publicUrl
        ? `${url}/client-metadata.json`
        : `http://localhost?redirect_uri=${enc(`${url}/oauth/callback`)}&scope=${enc("atproto transition:generic")}`,
      client_uri: url,
      redirect_uris: [`${url}/oauth/callback`],
      scope: "atproto transition:generic",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "web",
      token_endpoint_auth_method: "none",
      dpop_bound_access_tokens: true,
      jwks_uri: `${url}/api/oauth/jwks.json`,
    },

    // Now the keyset is correctly typed as Iterable<Key>:
    keyset: [key1],

    // Here’s the fixed stateStore implementation:
    stateStore: {
      async set(key: string, state: NodeSavedState): Promise<void> {
        stateMap.set(key, state);
      },
      // Note: the signature now takes an optional “options” param
      // and returns Promise<NodeSavedState | null>
      async get(key: string, options?: unknown): Promise<NodeSavedState | null> {
        return (stateMap.get(key) as NodeSavedState) || null;
      },
      async del(key: string): Promise<void> {
        stateMap.delete(key);
      },
    },

    // And the fixed sessionStore implementation:
    sessionStore: {
      async set(sub: string, session: NodeSavedSession): Promise<void> {
        sessionMap.set(sub, session);
      },
      async get(sub: string, options?: unknown): Promise<NodeSavedSession | null> {
        return (sessionMap.get(sub) as NodeSavedSession) || null;
      },
      async del(sub: string): Promise<void> {
        sessionMap.delete(sub);
      },
    },
  });

  return clientInstance;
}
