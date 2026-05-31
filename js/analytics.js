// Analytics and Report export module
// Aggregates financial reports, builds Chart.js canvases, and executes CSV/Excel exports.

class AnalyticsSystem {
  // Aggregate sales and profits from actual completed orders only
  getSummaryStats() {
    const db = window.dbManager.get();
    const todayStr = new Date().toISOString().split('T')[0];
    const completedOrders = db.orders.filter(o => o.status === "completed");
    
    const todayEntry = db.salesHistory.find(s => s.date === todayStr);
    let salesToday = todayEntry ? todayEntry.revenue : 0;
    let profitToday = todayEntry ? todayEntry.profit : 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    const itemCounts = {};

    completedOrders.forEach(order => {
      totalRevenue += order.total;
      let orderCost = 0;
      let orderProfit = 0;

      order.items.forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
        const menuItem = db.menuItems.find(m => m.id === item.itemId);
        if (menuItem) {
          const profit = menuItem.profit * item.quantity;
          orderProfit += profit;
          orderCost += (menuItem.sellingPrice - menuItem.profit) * item.quantity;
        }
      });

      totalProfit += orderProfit;
      totalCost += orderCost;
    });

    const activeOrders = db.orders.filter(o => o.status === "pending" || o.status === "cooking").length;
    const alerts = JSON.parse(localStorage.getItem("steve_stock_alerts") || "[]");
    const attendance = window.employeeSystem.getTodayAttendance();
    const presentCount = attendance.filter(a => a.status === "present" || a.status === "late").length;
    const absentCount = attendance.filter(a => a.status === "absent").length;
    const staffSummary = `${presentCount} Present / ${absentCount} Absent`;

    const topItems = Object.entries(itemCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      salesToday: parseFloat(salesToday.toFixed(2)),
      profitToday: parseFloat(profitToday.toFixed(2)),
      activeOrders,
      lowStockAlerts: alerts.length,
      staffSummary,
      topItems,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2))
    };
  }

  // Build chart data from actual completed orders grouped by date
  getSalesDataForPeriod(period) {
    const db = window.dbManager.get();
    const completedOrders = db.orders.filter(o => o.status === "completed");

    // Group orders by date
    const dailyMap = {};
    completedOrders.forEach(order => {
      if (!dailyMap[order.date]) dailyMap[order.date] = { revenue: 0, profit: 0 };
      dailyMap[order.date].revenue += order.total;
      order.items.forEach(item => {
        const mi = db.menuItems.find(m => m.id === item.itemId);
        if (mi) dailyMap[order.date].profit += mi.profit * item.quantity;
      });
    });

    const dates = Object.keys(dailyMap).sort();
    const labels = dates.map(d => d.substring(5));
    const revenue = dates.map(d => parseFloat(dailyMap[d].revenue.toFixed(2)));
    const profit = dates.map(d => parseFloat(dailyMap[d].profit.toFixed(2)));

    if (period === "1month") {
      return { labels, revenue, profit };
    } else if (period === "3months") {
      const weeklyLabels = [];
      const weeklyRev = [];
      const weeklyProf = [];
      for (let i = 0; i < dates.length; i += 7) {
        const chunkDates = dates.slice(i, i + 7);
        const revSum = chunkDates.reduce((s, d) => s + dailyMap[d].revenue, 0);
        const profSum = chunkDates.reduce((s, d) => s + dailyMap[d].profit, 0);
        weeklyLabels.push(`Week ${Math.floor(i/7) + 1}`);
        weeklyRev.push(parseFloat(revSum.toFixed(2)));
        weeklyProf.push(parseFloat(profSum.toFixed(2)));
      }
      return { labels: weeklyLabels, revenue: weeklyRev, profit: weeklyProf };
    } else {
      // today/yesterday/3days - get last N days
      const count = period === "today" ? 1 : period === "yesterday" ? 1 : 3;
      const recent = dates.slice(-count);
      return {
        labels: recent,
        revenue: recent.map(d => parseFloat(dailyMap[d].revenue.toFixed(2))),
        profit: recent.map(d => parseFloat(dailyMap[d].profit.toFixed(2)))
      };
    }
  }

  // Draw chart onto canvas
  renderChart(canvasId, period = "1month") {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // Destroy existing instance if active
    if (window.activeChartInstance) {
      window.activeChartInstance.destroy();
    }

    const chartData = this.getSalesDataForPeriod(period);
    const isDark = document.body.classList.contains("dark-theme");

    const textPrimary = isDark ? "#E2E8F0" : "#1E293B";
    const gridColor = isDark ? "rgba(148, 163, 184, 0.1)" : "rgba(15, 23, 42, 0.05)";

    const config = {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Revenue ($)',
            data: chartData.revenue,
            borderColor: '#6366F1', // Indigo gradient
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: period === "1month" ? 1 : 4,
            pointHoverRadius: 6
          },
          {
            label: 'Net Profit ($)',
            data: chartData.profit,
            borderColor: '#10B981', // Emerald green
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: period === "1month" ? 1 : 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: textPrimary,
              font: { family: 'Outfit, sans-serif', size: 12 }
            }
          },
          tooltip: {
            padding: 12,
            cornerRadius: 8,
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            titleColor: isDark ? '#FFFFFF' : '#1E293B',
            bodyColor: isDark ? '#CBD5E1' : '#475569',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            shadowColor: 'rgba(0, 0, 0, 0.25)',
            displayColors: true
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textPrimary,
              font: { family: 'Outfit, sans-serif', size: 10 }
            }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textPrimary,
              font: { family: 'Outfit, sans-serif', size: 10 }
            }
          }
        }
      }
    };

    window.activeChartInstance = new Chart(ctx, config);
    return window.activeChartInstance;
  }

  // Export tables into downloadable spreadsheets (CSV)
  exportToCSV(dataType) {
    const db = window.dbManager.get();
    let csvContent = "data:text/csv;charset=utf-8,";
    let filename = `${dataType}_report.csv`;

    if (dataType === "sales") {
      csvContent += "Date,Orders Completed,Total Revenue ($),Total Cost ($),Net Profit ($)\r\n";
      const dailyData = {};
      db.orders.filter(o => o.status === "completed").forEach(order => {
        if (!dailyData[order.date]) dailyData[order.date] = { orders: 0, revenue: 0, cost: 0, profit: 0 };
        dailyData[order.date].orders++;
        dailyData[order.date].revenue += order.total;
        order.items.forEach(item => {
          const mi = db.menuItems.find(m => m.id === item.itemId);
          if (mi) {
            dailyData[order.date].profit += mi.profit * item.quantity;
            dailyData[order.date].cost += (mi.sellingPrice - mi.profit) * item.quantity;
          }
        });
      });
      Object.keys(dailyData).sort().reverse().forEach(date => {
        const d = dailyData[date];
        csvContent += `${date},${d.orders},${d.revenue.toFixed(2)},${d.cost.toFixed(2)},${d.profit.toFixed(2)}\r\n`;
      });
    } else if (dataType === "profit") {
      csvContent += "Category,Description,Amount ($)\r\n";
      const stats = this.getSummaryStats();
      const salaryReport = window.employeeSystem.getSalaryReport();
      const totalSalaries = salaryReport.reduce((acc, curr) => acc + curr.totalSalary, 0);
      
      csvContent += `Revenue,Total lifetime sales,${stats.totalRevenue}\r\n`;
      csvContent += `Ingredient Costs,Raw materials consumed,${stats.totalCost}\r\n`;
      csvContent += `Salaries,Employee salaries based on attendance,${totalSalaries.toFixed(2)}\r\n`;
      csvContent += `Net Profit,Revenue minus costs and salaries,${(stats.totalRevenue - stats.totalCost - totalSalaries).toFixed(2)}\r\n`;
    } else if (dataType === "inventory") {
      csvContent += "Item,Category,Current Stock,Unit,Minimum Level,Cost Per Unit ($)\r\n";
      db.rawMaterials.forEach(item => {
        csvContent += `${item.name},${item.type},${item.quantity},${item.unit},${item.minStock},${item.costPerUnit}\r\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

const analyticsSystem = new AnalyticsSystem();
window.analyticsSystem = analyticsSystem; // Expose globally
