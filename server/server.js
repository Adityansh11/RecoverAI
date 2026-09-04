import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import Razorpay from "razorpay";
import { ethers } from "ethers";
import { diagnosePaymentFailure } from "./agents/diagnostician.js";
import { evaluatePolicy } from "./core/policyGuard.js";
import fs from "fs/promises";
import path from "path";

const LEDGER_PATH = "./processed_payments.json";
dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const auditLogs = [];

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const abi = [ "function logDecision(string,string,uint256) public" ];
const auditContract = new ethers.Contract(contractAddress, abi, wallet);

app.post("/api/recover", async (req, res) => {
  const event = req.body.event;
  console.log(`\n[SIMULATION] Received failed payment for INR ${event.amount / 100}`);

  try {
    const result = await
    processRecoveryWorkflow(event);
    auditLogs.unshift(result); 
    res.json(result);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/api/webhooks/razorpay", async (req, res) => {
  try {
    const paymentId = req.body?.payload?.payment?.entity?.id;
    
    // 1. Fallback for malformed requests
    if (!paymentId) {
      return res.status(400).json({ error: "Invalid Razorpay payload" });
    }

    // 2. Read the persistent state ledger
    let ledger = {};
    try {
      const data = await fs.readFile(LEDGER_PATH, "utf-8");
      ledger = JSON.parse(data);
    } catch (err) {
      console.log("[LEDGER] Initializing new state ledger...");
    }

    // 3. Idempotency Check: Drop duplicates instantly
    if (ledger[paymentId]) {
      console.log(`[IDEMPOTENCY] Blocked duplicate webhook for ID: ${paymentId}`);
      return res.status(200).json({ status: "duplicate_dropped" });
    }

    // 4. Register new ID to the ledger immediately
    ledger[paymentId] = { timestamp: new Date().toISOString() };
    await fs.writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2));

    // 5. Execute the autonomous AI & Blockchain workflow
console.log(`[WEBHOOK INCOMING] Processing unique failure: ${paymentId}`);
const paymentEntity = req.body.payload.payment.entity;
const result = await processRecoveryWorkflow(paymentEntity);

// Add this missing line to save the data for the frontend!
auditLogs.unshift(result); 

res.status(200).json({ received: true, status: "processed" });
  } catch (error) {
    console.error("[SERVER ERROR]", error);
    res.status(200).json({ status: "error", message: "Caught exception but returning 200" });
  }
});
app.get("/api/logs", (req, res) => {
  res.json(auditLogs);
});
async function processRecoveryWorkflow(event) {
  let aiDecision;
  
  // 1. Safe AI Fallback
  try {
    aiDecision = await diagnosePaymentFailure(event);
    console.log("\n[AI] Counterfactual Options Evaluated:", JSON.stringify(aiDecision.options, null, 2));
  } catch (aiError) {
    console.error("[AI ERROR] Gemini unreachable. Enforcing safe fallback.", aiError.message);
    aiDecision = {
      options: [],
      selectedStrategy: "DO_NOTHING",
      discountPercent: 0,
      expectedNet: 0
    };
  }

  const policyResult = evaluatePolicy(event, aiDecision);
  
  if (!policyResult.approved) {
    console.log("[BLOCKED] Action Blocked by Policy Guard:", policyResult.reason);
    return { status: "BLOCKED", policyResult, aiDecision, timestamp: new Date() };
  }

  console.log(`[APPROVED] Executing ${policyResult.finalAction} (Net Expected: INR ${policyResult.expectedNet}). Protected INR ${policyResult.marginProtected} in margin.`);

  // 2. Resilient Blockchain Logging (already non-blocking, but catching specific errors)
  let txHash = "PENDING";
  try {
    const tx = await auditContract.logDecision(
      event.id.toString(),
      policyResult.finalAction, 
      policyResult.boundedDiscount
    );
    txHash = tx.hash;
    console.log(`[BLOCKCHAIN] Decision permanently sealed. TX: ${txHash}`);
  } catch (err) {
    console.error("[BLOCKCHAIN WARNING] Ledger offline. Proceeding with recovery:", err.message);
  }
  
  // 3. Gateway Fallback
  let recoveryUrl = null;
  let finalStatus = "EXECUTED";
  try {
    const finalAmount = Math.round(event.amount * (1 - policyResult.boundedDiscount / 100));
    const paymentLink = await razorpay.paymentLink.create({
      amount: finalAmount,
      currency: "INR",
      reference_id: `rec_${event.id}_${Date.now()}`,
      description: "RecoverAI Autonomous Discounted Checkout",
      customer: { name: "Enterprise Test User", email: "secure-user@recoverai.internal", contact: "9876543210" }
    });
    recoveryUrl = paymentLink.short_url;
    console.log(`[GENERATED] Enterprise Recovery Link: ${recoveryUrl}`);
  } catch (rzpError) {
    console.error("[GATEWAY ERROR] Razorpay link generation failed:", rzpError.message);
    finalStatus = "GATEWAY_ERROR";
  }

  return { 
    status: finalStatus, 
    policyResult, 
    aiDecision,
    recoveryUrl,
    blockchainTx: txHash,
    timestamp: new Date()
  };
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[READY] Enterprise RecoverAI Server listening on port ${PORT}`);
});