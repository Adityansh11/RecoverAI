# RecoverAI 🚀
**AI-Powered Revenue Recovery Engine**

*Failed payment ≠ Lost revenue.*

RecoverAI is an AI-powered revenue recovery engine that analyzes failed payments, evaluates multiple recovery strategies, optimizes for net recovered value, and executes bounded recovery actions through Razorpay while maintaining deterministic policy controls, idempotency, and an auditable decision trail.

**Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery**
Razorpay × Gemini × Policy Guard × Blockchain Audit

## Problem
Failed online payments represent potentially lost revenue for merchants. Most payment recovery systems use generic approaches such as retrying the payment or sending a standard reminder. However, different payment failures may require different interventions.

The challenge is not only: *"Can we recover the payment?"* but: *"What recovery action maximizes the merchant's net recovered value while staying within predefined limits?"*

RecoverAI addresses this decision-making problem.

## Solution
RecoverAI creates an automated recovery pipeline:

Failed Payment → AI Diagnosis → Evaluate Multiple Strategies → Net Recovery Optimization → Policy Guard → (BLOCKED / APPROVED) → Razorpay Recovery → Blockchain Audit → Persistent Ledger

The system separates AI intelligence from financial control: **Gemini recommends. Policy Guard decides what is allowed.**
AI Decision Engine
RecoverAI does not blindly ask an LLM to choose a discount. Instead, the AI evaluates multiple counterfactual recovery strategies.

Optimization Objective
Expected Net Recovery = Expected Recovery - Intervention Cost

The objective is to maximize net recovered value, rather than simply maximizing the number of recovered transactions.

Policy Guard
AI-generated recommendations are never executed without validation. The deterministic Policy Guard acts as a safety boundary between AI recommendations and financial actions.

Example Policies

Maximum allowed discount

Minimum acceptable net recovery

Allowed recovery strategies

Escalation conditions

Duplicate-event protection

Bounded financial actions

Idempotency and Reliability
Payment systems can deliver the same event more than once. RecoverAI prevents duplicate recovery actions by using the payment ID as an idempotency key. A duplicate event does not trigger another Gemini decision, recovery link, or blockchain audit.

Blockchain Auditability
Approved recovery decisions are recorded on a local Ethereum testnet using Hardhat. This provides a verifiable audit anchor for the recovery decision containing the Payment ID, Final Action, and Bounded Discount.

Note: Blockchain is used strictly for decision auditability, not as the payment processor.

Demo
Demo Video: [Add your Google Drive or YouTube demo link here]

Getting Started
1. Clone the Repository

Bash
git clone <YOUR_REPOSITORY_URL>
cd RecoverAI
2. Install Dependencies

Bash
npm install
cd frontend
npm install
cd ..
3. Configure Environment Variables
Create a .env file in the root directory:

Code snippet
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
GEMINI_API_KEY=your_gemini_key
PORT=5000
4. Start Hardhat & Deploy Audit Contract

Bash
npx hardhat node
# Deploy RecoverAIAudit.sol to the local network and update backend address
5. Start the Backend and Frontend

Bash
node server.js
cd frontend
npm run dev
Example Webhook Event
JSON
{
  "event": "payment.failed",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_test_001",
        "amount": 10000,
        "currency": "INR",
        "status": "failed",
        "method": "card",
        "error_code": "BAD_REQUEST_ERROR"
      }
    }
  }
}
Core Innovation
Net Recovery Optimization + Controlled AI Execution

Built for Razorpay AI Buildathon 2026 — Track: AI Revenue Recovery

## Architecture

```mermaid
flowchart TD
    A[Razorpay Payment Event] --> B[Node.js / Express Backend]
    B --> C[Idempotency Check]
    C -->|Duplicate| D[Stop / Return Existing State]
    C -->|New Event| E[Gemini AI Diagnostician]
    E --> F[Counterfactual Strategy Evaluation]
    F --> F1[Retry]
    F --> F2[Payment Method Switch]
    F --> F3[Discount Offer]
    F --> F4[Do Nothing]
    F1 --> G[Policy Guard]
    F2 --> G
    F3 --> G
    F4 --> G
    G -->|Rejected| H[Blocked / Escalation]
    G -->|Approved| I[Razorpay Payment Link]
    G --> J[Hardhat Ethereum Audit]
    I --> J
    J --> K[Persistent State Ledger]
    K --> L[React Dashboard]
