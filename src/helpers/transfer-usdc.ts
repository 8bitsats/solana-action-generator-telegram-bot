/**
 * USDC Transfer Helper Function for Cloudflare Worker
 */
import {
    Connection,
    PublicKey,
    Transaction,
    clusterApiUrl,
  } from "@solana/web3.js";
  import { createTransferInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
  
  const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Mainnet USDC mint
  
  interface TransferUSDCParams {
    fromPubkey: PublicKey;
    toPubkey: PublicKey;
    amount: number;
    connection: Connection;
  }
  
  export async function createUSDCTransferTransaction({
    fromPubkey,
    toPubkey,
    amount,
    connection,
  }: TransferUSDCParams): Promise<Transaction> {
    try {
      const fromTokenAccount = getAssociatedTokenAddressSync(USDC_MINT, fromPubkey);
      const toTokenAccount = getAssociatedTokenAddressSync(USDC_MINT, toPubkey);
  
      const transaction = new Transaction();
  
      // USDC has 6 decimal places
      const amountInUsdcUnits = BigInt(Math.round(amount * 1_000_000));
  
      transaction.add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromPubkey,
          amountInUsdcUnits
        )
      );
  
      transaction.feePayer = fromPubkey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
      return transaction;
    } catch (error) {
      console.log("error")
      console.error("Error creating USDC transfer transaction:", error);
      throw error;
    }
  }
  