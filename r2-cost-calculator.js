const DAYS_PER_MONTH = 30;

// Adjust these prices to your current provider plan.
const PRICING = {
  storagePerGbMonth: 0.015,
  classAWritePerMillion: 4.5,
  classBReadPerMillion: 0.36,
  dataTransferPerGb: 0
};

const SCENARIOS = [
  {
    name: 'MVP activo',
    imagesPerDay: 5000,
    avgImageMb: 0.4,
    avgViewsPerImage: 2,
    ttlDays: 1,
    cacheHitRate: 0.5
  },
  {
    name: 'Crecimiento medio',
    imagesPerDay: 50000,
    avgImageMb: 0.4,
    avgViewsPerImage: 3,
    ttlDays: 1,
    cacheHitRate: 0.6
  },
  {
    name: 'Escala alta',
    imagesPerDay: 200000,
    avgImageMb: 0.4,
    avgViewsPerImage: 5,
    ttlDays: 1,
    cacheHitRate: 0.7
  }
];

function round(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function calculateScenarioCost(input) {
  const uploadsPerDay = input.imagesPerDay;
  const viewsPerDay = input.imagesPerDay * input.avgViewsPerImage;
  const originReadRequestsPerDay = viewsPerDay * (1 - input.cacheHitRate);

  const storedGbAverage = (input.imagesPerDay * input.avgImageMb * input.ttlDays) / 1024;
  const originDataGbPerDay = (originReadRequestsPerDay * input.avgImageMb) / 1024;

  const uploadsPerMonth = uploadsPerDay * DAYS_PER_MONTH;
  const originReadRequestsPerMonth = originReadRequestsPerDay * DAYS_PER_MONTH;
  const originDataGbPerMonth = originDataGbPerDay * DAYS_PER_MONTH;

  const storageCost = storedGbAverage * PRICING.storagePerGbMonth;
  const writeCost = (uploadsPerMonth / 1_000_000) * PRICING.classAWritePerMillion;
  const readCost = (originReadRequestsPerMonth / 1_000_000) * PRICING.classBReadPerMillion;
  const transferCost = originDataGbPerMonth * PRICING.dataTransferPerGb;

  const total = storageCost + writeCost + readCost + transferCost;

  return {
    scenario: input.name,
    uploadsPerDay,
    originReadRequestsPerDay: round(originReadRequestsPerDay),
    originDataGbPerDay: round(originDataGbPerDay),
    storedGbAverage: round(storedGbAverage),
    monthlyCostUsd: round(total),
    breakdown: {
      storageCostUsd: round(storageCost),
      writeCostUsd: round(writeCost),
      readCostUsd: round(readCost),
      transferCostUsd: round(transferCost)
    }
  };
}

function printScenario(result) {
  console.log('');
  console.log('Scenario:', result.scenario);
  console.log('  Uploads/day:', result.uploadsPerDay);
  console.log('  Origin reads/day (after cache):', result.originReadRequestsPerDay);
  console.log('  Origin data/day (GB):', result.originDataGbPerDay);
  console.log('  Average stored (GB):', result.storedGbAverage);
  console.log('  Monthly total (USD):', result.monthlyCostUsd);
  console.log('  Breakdown (USD):', result.breakdown);
}

function main() {
  console.log('R2 cost calculator (approximation)');
  console.log('Pricing:', PRICING);

  SCENARIOS.map(calculateScenarioCost).forEach(printScenario);
}

main();
