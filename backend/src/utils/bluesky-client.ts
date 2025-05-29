// lib/bluesky-client.ts
import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { env } from "process";

let clientInstance: NodeOAuthClient | null = null;
const stateStore = new Map();
const sessionStore = new Map();

export async function getBlueskyClient() {
  if (clientInstance) return clientInstance;
  const publicUrl = env.PUBLIC_URL
  const url = publicUrl || `http://127.0.0.1:${env.PORT}`
  const enc = encodeURIComponent
  clientInstance = new NodeOAuthClient({
    clientMetadata: {
      client_name: 'Bluesky Messagner',
      client_id: publicUrl
        ? `${url}/client-metadata.json`
        : `http://localhost?redirect_uri=${enc(`${url}/oauth/callback`)}&scope=${enc('atproto transition:generic')}`,
      client_uri: url,
      redirect_uris: [`${url}/oauth/callback`],
      scope: 'atproto transition:generic',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      token_endpoint_auth_method: 'none',
      dpop_bound_access_tokens: true,
      jwks_uri: `${url}/api/oauth/jwks.json`
    },

    keyset: await Promise.all([
      JoseKey.fromImportable(process.env.PRIVATE_KEY_1),
    ]),

    stateStore: {
      async set(key: string, state: any) {
        stateStore.set(key, state);
      },
      async get(key: string) {
        return stateStore.get(key);
      },
      async del(key: string) {
        stateStore.delete(key);
      }
    },

    sessionStore: {
      async set(sub: string, session: any) {
        sessionStore.set(sub, session);
      },
      async get(sub: string) {
        return sessionStore.get(sub);
      },
      async del(sub: string) {
        sessionStore.delete(sub);
      }
    }
  });

  return clientInstance;
}