import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function diagnosePaymentFailure(event) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const prompt = `
    You are a Counterfactual Recovery Engine for an enterprise payment system.
    A payment of INR ${event.amount / 100} failed with error: ${event.errorCode}.
    Merchant historical context: UPI retries have 72% success, discounts over 10% erode margin.

    Return a strictly formatted JSON array of 3 potential interventions. For each, calculate:
    - strategy (string: RETRY_LATER, DISCOUNT_OFFER, DO_NOTHING)
    - discountPercent (number, 0 if none)
    - expectedGross (number, INR)
    - expectedCost (number, INR)
    - expectedNet (number, expectedGross - expectedCost)

    Output ONLY JSON. Example format:
    {
      "options": [
        { "strategy": "DISCOUNT_OFFER", "discountPercent": 5, "expectedGross": 95, "expectedCost": 5, "expectedNet": 90 }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().replace(/```json/g, "").replace(/```/g, "");
  return JSON.parse(responseText);
}