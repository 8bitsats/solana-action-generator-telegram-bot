// src/controllers/solana-action-app.ts
import { KVNamespace } from '@cloudflare/workers-types';
import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import { ActionPostResponse, createPostResponse } from "@solana/actions";
import { createUSDCTransferTransaction } from "../helpers/transfer-usdc";

export interface USDCTransferActionSpec {
  title: string;
  icon: string;
  description: string;
  label: string;
  predefinedAmounts: number[];
  recipient: string; // This should be a valid Solana address
}

interface ActionLink {
    label: string;
    href: string;
    parameters?: Array<{
        name: string;
        label: string;
        required: boolean;
    }>;
}

interface FullUSDCTransferActionSpec extends USDCTransferActionSpec {
id: string;
links: {
    actions: ActionLink[];
};
}
  
function generateUniqueId(): string {
  return crypto.randomUUID();
}
export async function createUSDCTransferActionApp(
  env: {
    SOLANA_ACTION_APPS: KVNamespace;
    BASE_URL: string;
  },
  spec: USDCTransferActionSpec
): Promise<{ id: string, endpoint: string }> {
  // Validate the spec
  if (!spec.title || !spec.icon || !spec.description || !spec.label || 
      !Array.isArray(spec.predefinedAmounts) || !spec.recipient) {
    throw new Error('Invalid USDC Transfer Action specification');
  }

  // Validate the recipient address
  try {
    new PublicKey(spec.recipient);
  } catch (err) {
    throw new Error('Invalid recipient Solana address');
  }

  const id = generateUniqueId();
  // Create the full specification object
  const fullSpec: FullUSDCTransferActionSpec = {
    id,
    ...spec,
    links: {
      actions: [
        ...spec.predefinedAmounts.map(amount => ({
          label: `Send ${amount} USDC`,
          href: `${env.BASE_URL}/endpoint/app/${id}/transfer-usdc?amount=${amount}`,
        }))
      ],
    },
  };
 
  // Save the specification to KV
  await env.SOLANA_ACTION_APPS.put(id, JSON.stringify(fullSpec));

  console.log(`USDC Transfer Action app "${id}" created and saved to KV.`);
  return {
    id,
    endpoint: `${env.BASE_URL}/endpoint/app/${id}`
  };
}

export async function endpointGetUSDCTransfer(
  env: {
    SOLANA_ACTION_APPS: KVNamespace;
  },
  id: string
): Promise<FullUSDCTransferActionSpec | null> {
  const specString = await env.SOLANA_ACTION_APPS.get(id);
  return specString ? JSON.parse(specString) : null;
}

export async function endpointPostUSDCTransfer(
  env: {
    SOLANA_ACTION_APPS: KVNamespace;
  },
  id: string,
  body: { account: string; amount?: number }
): Promise<ActionPostResponse | { error: string }> {
  const spec = await endpointGetUSDCTransfer(env, id);

  if (!spec) {
    return { error: 'App not found' };
  }
  const fromPubkey = new PublicKey(body.account);
  const toPubkey = new PublicKey(spec.recipient);
  const amount = body.amount;

  const connection = new Connection(clusterApiUrl("mainnet-beta"));

  const transaction = await createUSDCTransferTransaction({
    fromPubkey,
    toPubkey,
    amount: amount ?? spec.predefinedAmounts[0],
    connection
  });

  const payload: ActionPostResponse = await createPostResponse({
    fields: {
      transaction,
      message: `Send ${amount} USDC to ${spec.recipient}`,
    },
  });

  return payload;
}

export async function deleteUSDCTransferActionApp(
  env: {
    SOLANA_ACTION_APPS: KVNamespace;
  },
  id: string
): Promise<void> {
  await env.SOLANA_ACTION_APPS.delete(id);
  console.log(`USDC Transfer Action app "${id}" deleted from KV.`);
}
