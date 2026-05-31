// Inventory management module
// Tracks raw materials, applies usage deduction on order placement, and generates runout warning forecasts.

class InventorySystem {
  constructor() {
    this.refreshStockPredictions();
  }

  // Deduct ingredients for a given menu item and quantity
  deductIngredients(itemId, quantity) {
    const db = window.dbManager.get();
    const menuItem = db.menuItems.find(m => m.id === itemId);
    if (!menuItem) return;

    let success = true;
    const recipe = menuItem.recipe || [];

    // Check if we have enough stock first
    recipe.forEach(req => {
      const material = db.rawMaterials.find(m => m.id === req.materialId);
      if (material) {
        const requiredAmount = req.quantity * quantity;
        if (material.quantity < requiredAmount) {
          success = false; // Soft fail, we'll still record it but mark it out-of-stock
        }
      }
    });

    // Deduct stock
    recipe.forEach(req => {
      const material = db.rawMaterials.find(m => m.id === req.materialId);
      if (material) {
        const requiredAmount = req.quantity * quantity;
        let newQty = material.quantity - requiredAmount;
        if (material.unit === 'pcs') {
          material.quantity = Math.max(0, Math.floor(newQty));
        } else {
          material.quantity = Math.max(0, parseFloat(newQty.toFixed(3)));
        }
      }
    });

    window.dbManager.save(db);
    this.refreshStockPredictions();
    return success;
  }

  // Restore ingredients (e.g., if order is cancelled)
  restoreIngredients(itemId, quantity) {
    const db = window.dbManager.get();
    const menuItem = db.menuItems.find(m => m.id === itemId);
    if (!menuItem) return;

    const recipe = menuItem.recipe || [];
    recipe.forEach(req => {
      const material = db.rawMaterials.find(m => m.id === req.materialId);
      if (material) {
        const amountToRestore = req.quantity * quantity;
        let newQty = material.quantity + amountToRestore;
        if (material.unit === 'pcs') {
          material.quantity = Math.floor(newQty);
        } else {
          material.quantity = parseFloat(newQty.toFixed(3));
        }
      }
    });

    window.dbManager.save(db);
    this.refreshStockPredictions();
  }

  // Verify daily startup stock status
  hasDailyStockBeenSet() {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastSetup = localStorage.getItem("steve_last_stock_setup");
    return lastSetup === todayStr;
  }

  setDailyStock(stockValues) {
    const db = window.dbManager.get();
    db.rawMaterials.forEach(material => {
      if (stockValues[material.id] !== undefined) {
        material.quantity = material.unit === 'pcs' ? parseInt(stockValues[material.id]) : parseFloat(stockValues[material.id]);
      }
    });
    window.dbManager.save(db);
    localStorage.setItem("steve_last_stock_setup", new Date().toISOString().split('T')[0]);
    this.refreshStockPredictions();
  }

  // Predict low stock depletion time based on average sales velocity
  refreshStockPredictions() {
    const db = window.dbManager.get();
    const predictions = [];
    const alerts = [];

    // Heuristics: calculate standard usage per order based on typical distribution
    // Chicken: 1.2kg/hour, Buns: 6/hour, Cheese: 0.8kg/hour, etc.
    const averageUsageRatesPerHour = {
      chicken: 0.85,
      cheese: 0.55,
      flour: 0.65,
      potatoes: 1.5,
      sauce: 0.35,
      oil: 0.25,
      bun: 4.5,
      bottles: 6.0,
      eggs: 5.0,
      boxes: 3.5
    };

    db.rawMaterials.forEach(m => {
      const usageRate = averageUsageRatesPerHour[m.id] || 0.1;
      const hoursLeft = usageRate > 0 ? (m.quantity / usageRate) : 999;
      
      // Stock health categories: 'critical', 'warning', 'healthy'
      let status = "healthy";
      if (m.quantity <= m.minStock) {
        status = "critical";
      } else if (hoursLeft < 4) {
        status = "warning";
      }

      predictions.push({
        id: m.id,
        name: m.name,
        currentStock: m.quantity,
        unit: m.unit,
        hoursRemaining: parseFloat(hoursLeft.toFixed(1)),
        status: status
      });

      if (status === "critical") {
        alerts.push({
          type: "critical",
          message: `${m.name} is critically low (${m.quantity} ${m.unit} left). Re-stock immediately.`
        });
      } else if (status === "warning") {
        alerts.push({
          type: "warning",
          message: `Warning: ${m.name} stock may run out in ${hoursLeft.toFixed(1)} hours.`
        });
      }
    });

    this.predictions = predictions;
    this.alerts = alerts;
    
    // Save prediction alerts to local storage so app can view them
    localStorage.setItem("steve_stock_alerts", JSON.stringify(alerts));
  }

  getPredictions() {
    this.refreshStockPredictions();
    return this.predictions;
  }

  getAlerts() {
    this.refreshStockPredictions();
    return this.alerts;
  }
}

const inventorySystem = new InventorySystem();
window.inventorySystem = inventorySystem; // Expose globally
