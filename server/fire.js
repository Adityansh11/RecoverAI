const payload = {
  event: "payment.failed",
  payload: {
    payment: {
      entity: {
        id: "pay_test_001",
        amount: 10000,
        currency: "INR",
        status: "failed",
        method: "card",
        error_code: "BAD_REQUEST_ERROR",
        error_description: "Payment failed due to bank decline",
        email: "customer@example.com"
      }
    }
  }
};

fetch("http://localhost:5000/api/webhooks/razorpay", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
})
  .then(async (res) => {
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  })
  .catch((err) => {
    console.error("Request failed:", err);
  });