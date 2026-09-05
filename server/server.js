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
    const result = await processRecoveryWorkflow(event);
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
    
    if (!paymentId) {
      return res.status(400).json({ error: "Invalid Razorpay payload" });
    }

    let ledger = {};
    try {
      const data = await fs.readFile(LEDGER_PATH, "utf-8");
      ledger = JSON.parse(data);
    } catch (err) {
      console.log("[LEDGER] Initializing new state ledger...");
    }

    if (ledger[paymentId]) {
      console.log(`[IDEMPOTENCY] Blocked duplicate webhook for ID: ${paymentId}`);
      return res.status(200).json({ status: "duplicate_dropped" });
    }

    ledger[paymentId] = { timestamp: new Date().toISOString() };
    await fs.writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2));

    console.log(`[WEBHOOK INCOMING] Processing unique failure: ${paymentId}`);
    const paymentEntity = req.body.payload.payment.entity;
    const result = await processRecoveryWorkflow(paymentEntity);

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
  
  try {
    aiDecision = await diagnosePaymentFailure(event);
    console.log("\n[AI] Counterfactual Options Evaluated:", JSON.stringify(aiDecision.options, null, 2));
  } catch (aiError) {
    console.error("[AI ERROR] Gemini quota exceeded. Using default recovery fallback.");
    
    // Dynamically calculate the INR value based on the incoming paise amount
    const originalAmountInRupees = event.amount / 100;
    const discountedAmountInRupees = originalAmountInRupees * 0.95;

    aiDecision = {
      selectedStrategy: "OFFER_DISCOUNT",
      options: [
        {
          strategy: "OFFER_DISCOUNT",
          discountPercent: 5,
          expectedNet: discountedAmountInRupees
        }
      ]
    };
  }

  const policyResult = evaluatePolicy(event, aiDecision);
  
  if (!policyResult.approved) {
    console.log("[BLOCKED] Action Blocked by Policy Guard:", policyResult.reason);
    return { status: "BLOCKED", policyResult, aiDecision, timestamp: new Date() };
  }

  console.log(`[APPROVED] Executing ${policyResult.finalAction} (Net Expected: INR ${policyResult.expectedNet}). Protected INR ${policyResult.marginProtected} in margin.`);

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
  
  let recoveryUrl = null;
  let finalStatus = "EXECUTED";
  try {
    const finalAmount = Math.round(event.amount * (1 - policyResult.boundedDiscount / 100));
    
    const rzpResponse = await razorpay.paymentLink.create({
      amount: finalAmount,
      currency: "INR",
      description: `RecoverAI Discounted Settlement for ${event.id}`,
      customer: {
        name: "Valued Customer",
        email: "customer@example.com",
        contact: "9854236999",
      },
      notify: { sms: false, email: false },
      reminder_enable: true,
    });

    recoveryUrl = rzpResponse.short_url;
    console.log(`[RAZORPAY] Live Payment Link Generated: ${recoveryUrl}`);
  } catch (rzpError) {
    const errorDetails = rzpError.error?.description || JSON.stringify(rzpError);
    console.error("[GATEWAY ERROR] Razorpay link generation failed:", errorDetails);
    
    recoveryUrl = `https://rzp.io/i/mock_${event.id}`;
    finalStatus = "MOCKED_LINK";
    console.log(`[RAZORPAY FALLBACK] Mock Link Generated: ${recoveryUrl}`);
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