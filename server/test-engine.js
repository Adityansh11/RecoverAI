async function run() {
  const response = await fetch("http://localhost:5000/api/recover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: { 
        id: "TXN_123", 
        amount: 500000, 
        errorCode: "CHECKOUT_ABANDONED", 
        attemptCount: 1 // Try changing this to 4 later to see the shield block it!
      }
    })
  });
  const data = await response.json();
  console.log("\nServer Response:", data);
}
run();