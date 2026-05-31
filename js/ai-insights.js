// AI Business Insights engine
// Runs heuristics to analyze sales, employee performance, and inventory trends to generate predictions and suggestions.

class AIInsightsSystem {
  generateInsights() {
    const db = window.dbManager.get();
    const stats = window.analyticsSystem.getSummaryStats();
    const predictions = window.inventorySystem.getPredictions();

    // 1. Most profitable food item
    const mostProfitable = [...db.menuItems].sort((a, b) => b.profit - a.profit)[0];

    // 2. Least selling item from actual order data
    const itemCountMap = {};
    db.orders.filter(o => o.status === "completed").forEach(o => {
      o.items.forEach(it => { itemCountMap[it.name] = (itemCountMap[it.name] || 0) + it.quantity; });
    });
    const leastSellingName = Object.entries(itemCountMap).sort((a, b) => a[1] - b[1])[0]?.[0];
    const leastSelling = leastSellingName ? { name: leastSellingName } : null;

    // 3. Peak order times
    const orderHours = db.orders.map(o => parseInt(o.time?.split(':')[0]) || 0).filter(h => h > 0);
    const hourCounts = {};
    orderHours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
    const peakTimes = sortedHours.length > 0
      ? sortedHours.slice(0, 2).map(([h]) => `${h.padStart(2, '0')}:00`).join(' & ')
      : "No orders yet";

    // 4. Inventory running out fastest
    const criticalItems = predictions
      .filter(p => p.status === "critical" || p.status === "warning")
      .sort((a, b) => a.hoursRemaining - b.hoursRemaining);
    
    const fastestRunningOut = criticalItems.length > 0 
      ? `${criticalItems[0].name} (approx. ${criticalItems[0].hoursRemaining} hours left)`
      : "All stock levels healthy";

    // 5. Employee productivity insights based on actual orders completed
    const employeeOrderCounts = {};
    db.orders.filter(o => o.status === "completed").forEach(o => {
      if (o.employee_name) {
        employeeOrderCounts[o.employee_name] = (employeeOrderCounts[o.employee_name] || 0) + 1;
      }
    });
    const topEmpName = Object.entries(employeeOrderCounts).sort((a, b) => b[1] - a[1])[0];
    const topEmployee = topEmpName
      ? db.employees.find(e => e.name === topEmpName[0])
      : db.employees.sort((a, b) => b.rating - a.rating)[0];
    const topEmpOrders = topEmpName ? topEmpName[1] : 0;
    const productivityInsight = topEmployee
      ? `${topEmployee.name} (${topEmployee.role}) is leading with ${topEmpOrders} orders completed.`
      : 'No employee data available.';

    // 6. Recommended stock purchasing quantities
    const procurementAdvice = [];
    predictions.forEach(p => {
      if (p.status === "critical" || p.status === "warning") {
        // Recommend buying double the minimum stock level
        const material = db.rawMaterials.find(m => m.id === p.id);
        const orderQty = material ? Math.ceil(material.minStock * 2) : 10;
        procurementAdvice.push({
          name: p.name,
          recommendation: `Order ${orderQty} ${p.unit} from your active supplier.`
        });
      }
    });

    if (procurementAdvice.length === 0) {
      procurementAdvice.push({
        name: "General Restock",
        recommendation: "All materials stable. Restock standard weekly items on Sunday."
      });
    }

    return {
      mostProfitableItem: mostProfitable ? `${mostProfitable.name} (Margin: $${mostProfitable.profit})` : "N/A",
      mostDemandedItem: stats.topItems[0] ? `${stats.topItems[0].name} (Volume: ${stats.topItems[0].count} orders)` : "N/A",
      leastSellingItem: `${leastSelling.name} (Low volume)`,
      peakOrderTimes: peakTimes,
      fastestRunningOut,
      productivityInsight,
      procurementAdvice
    };
  }
}

const aiInsightsSystem = new AIInsightsSystem();
window.aiInsightsSystem = aiInsightsSystem; // Expose globally
