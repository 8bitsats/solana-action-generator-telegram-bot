import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { createUSDCTransferTransaction } from "../helpers/transfer-usdc";
  
export async function handleRequest(request: Request, env: { SOLANA_RPC?: string, SOLANA_ACTION_APPS: KVNamespace }): Promise<Response> {
  const url = new URL(request.url);
  
  if (request.method === "GET") {
    return handleGet(url, env);
  } else if (request.method === "POST") {
    return handlePost(request, url, env);
  } else if (request.method === "OPTIONS") {
    return new Response(null, { headers: ACTIONS_CORS_HEADERS });
  }
  
  return new Response("Method not allowed", { status: 405, headers: ACTIONS_CORS_HEADERS });
}
  
async function handleGet(url: URL, env: { SOLANA_ACTION_APPS: KVNamespace }): Promise<Response> {
  try {
    const appId = 'usdc-transfer-action';
    const specString = await env.SOLANA_ACTION_APPS.get(appId);
    
    if (!specString) {
      throw new Error('USDC Transfer Action specification not found');
    }

    const spec = JSON.parse(specString);
    const baseHref = new URL("/transfer-usdc", url.origin).toString();
  
    // Modify the links to include the full base URL
    const payload: ActionGetResponse = {
      ...spec,
      links: {
        actions: spec.links.actions.map((action: { href: string; }) => ({
          ...action,
          href: action.href.startsWith('/') ? `${baseHref}${action.href.slice(1)}` : `${baseHref}${action.href}`,
        })),
      },
    };
  
    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (err) {
    console.error(err);
    return new Response("An error occurred", { status: 400, headers: ACTIONS_CORS_HEADERS });
  }
}
  
async function handlePost(request: Request, url: URL, env: { SOLANA_RPC?: string, SOLANA_ACTION_APPS: KVNamespace }): Promise<Response> {
  try {
    const { amount } = validatedQueryParams(url);
    const body: ActionPostRequest = await request.json();
  
    let fromPubkey: PublicKey;
    try {
      fromPubkey = new PublicKey(body.account);
    } catch (err) {
      return new Response('Invalid "account" provided', { status: 400, headers: ACTIONS_CORS_HEADERS });
    }
  
    // Fetch the recipient from the stored specification
    const appId = 'usdc-transfer-action';
    const specString = await env.SOLANA_ACTION_APPS.get(appId);
    if (!specString) {
      throw new Error('USDC Transfer Action specification not found');
    }
    const spec = JSON.parse(specString);
    const recipient = new PublicKey(spec.recipient);
    const connection = new Connection(env.SOLANA_RPC || clusterApiUrl("mainnet-beta"));
  
    const transaction = await createUSDCTransferTransaction({
      fromPubkey,
      toPubkey: recipient,
      amount,
      connection,
    });
  
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Send ${amount} USDC to ${recipient.toBase58()}`,
      },
    });
  
    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (err) {
    console.error(err);
    return new Response("An error occurred", { status: 400, headers: ACTIONS_CORS_HEADERS });
  }
}
  
function validatedQueryParams(url: URL) {
  const amount = parseFloat(url.searchParams.get("amount") || "");
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Invalid amount");
  }
  
  return { amount };
}
