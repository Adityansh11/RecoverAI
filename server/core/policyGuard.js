export function evaluatePolicy(event, aiDecision) {
  const MAX_DISCOUNT = 10;
  let bestOption = null;
  let highestNet = -1;
  let marginProtected = 0;

  for (const option of aiDecision.options) {
    if (option.discountPercent > MAX_DISCOUNT) {
      marginProtected += option.expectedCost;
      continue;
    }

    if (option.expectedNet > highestNet) {
      highestNet = option.expectedNet;
      bestOption = option;
    }
  }

  if (!bestOption) {
    return { approved: false, reason: "All AI options violated merchant constraints", marginProtected };
  }

  return {
    approved: true,
    finalAction: bestOption.strategy,
    boundedDiscount: bestOption.discountPercent,
    expectedNet: bestOption.expectedNet,
    marginProtected
  };
}