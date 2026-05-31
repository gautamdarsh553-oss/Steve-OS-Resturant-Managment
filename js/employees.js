// Employee management module
// Controls staff attendance, shift timings, overtime, performance evaluations, and salary reports.

class EmployeeSystem {
  constructor() {
    this.initAttendanceToday();
  }

  initAttendanceToday() {
    const db = window.dbManager.get();
    const todayStr = new Date().toISOString().split('T')[0];

    if (!db.attendance[todayStr]) {
      // Initialize all active employees as absent/unmarked for today
      db.attendance[todayStr] = db.employees.map(e => ({
        employeeId: e.id,
        status: "unmarked",
        timeIn: null,
        timeOut: null
      }));
      window.dbManager.save(db);
    }
  }

  // Set attendance status manually or via voice
  markAttendance(employeeNameOrId, status, time = null) {
    const db = window.dbManager.get();
    const todayStr = new Date().toISOString().split('T')[0];

    // Shift must be active to mark attendance
    if (!db.shiftActive) {
      return { success: false, message: 'Start the shift before marking attendance.' };
    }
    
    // Find employee either by exact ID or case-insensitive name match
    let emp = db.employees.find(e => e.id === employeeNameOrId);
    if (!emp) {
      emp = db.employees.find(e => e.name.toLowerCase() === employeeNameOrId.toLowerCase());
    }

    if (!emp) return { success: false, message: `Employee "${employeeNameOrId}" not found.` };

    // Initialize attendance record if missing
    if (!db.attendance[todayStr]) {
      this.initAttendanceToday();
    }

    const todayRecords = db.attendance[todayStr];
    const record = todayRecords.find(r => r.employeeId === emp.id);

    if (record) {
      record.status = status.toLowerCase(); // 'present', 'absent', 'late'
      if (status.toLowerCase() === "present" || status.toLowerCase() === "late") {
        if (!time) {
          const now = new Date();
          time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
        record.timeIn = time;
        
        // Determine late arrival based on shift start
        const shiftStart = emp.shift.split(" - ")[0]; // e.g., "08:00"
        const [startH, startM] = shiftStart.split(":").map(Number);
        const [inH, inM] = time.split(":").map(Number);
        
        if (inH > startH || (inH === startH && inM > startM + 10)) {
          record.status = "late";
        }
      } else {
        record.timeIn = null;
        record.timeOut = null;
      }
      
      window.dbManager.save(db);
      return { success: true, employee: emp, status: record.status, time: record.timeIn };
    }
    return { success: false, message: "Attendance record error." };
  }

  clockOut(employeeId) {
    const db = window.dbManager.get();
    if (!db.shiftActive) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    const records = db.attendance[todayStr];
    if (!records) return false;

    const record = records.find(r => r.employeeId === employeeId);
    if (record && (record.status === "present" || record.status === "late")) {
      const now = new Date();
      record.timeOut = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      window.dbManager.save(db);
      return true;
    }
    return false;
  }

  getTodayAttendance() {
    const db = window.dbManager.get();
    const todayStr = new Date().toISOString().split('T')[0];
    const records = db.attendance[todayStr] || [];

    return records.map(r => {
      const emp = db.employees.find(e => e.id === r.employeeId);
      return {
        id: r.employeeId,
        name: emp ? emp.name : "Unknown",
        role: emp ? emp.role : "N/A",
        shift: emp ? emp.shift : "N/A",
        status: r.status,
        timeIn: r.timeIn,
        timeOut: r.timeOut
      };
    });
  }

  // Calculate salary from actual clock hours (real-time for active shifts)
  getSalaryReport(todayOnly = false) {
    const db = window.dbManager.get();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (todayOnly && !db.shiftActive) {
      return db.employees.map(emp => ({
        id: emp.id, name: emp.name, role: emp.role, hourlyRate: emp.hourlyRate,
        presentDays: 0, absentDays: 0, lateDays: 0,
        actualHours: 0, overtimeHours: 0,
        baseSalary: 0, overtimeSalary: 0, totalSalary: 0
      }));
    }

    return db.employees.map(emp => {
      let actualHours = 0;
      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;

      if (db.attendance) {
        const dateEntries = todayOnly
          ? (db.attendance[today] ? [[today, db.attendance[today]]] : [])
          : Object.entries(db.attendance);

        dateEntries.forEach(([date, records]) => {
          const record = records.find(r => r.employeeId === emp.id);
          if (!record) return;

          if (record.status === 'absent') {
            absentDays++;
            return;
          }

          if (record.status === 'present' || record.status === 'late') {
            presentDays++;
            if (record.status === 'late') lateDays++;

            if (record.timeIn) {
              const [inH, inM] = record.timeIn.split(':').map(Number);
              let outH, outM;

              if (record.timeOut) {
                [outH, outM] = record.timeOut.split(':').map(Number);
              } else {
                outH = now.getHours();
                outM = now.getMinutes();
              }

              let hoursWorked = (outH + outM / 60) - (inH + inM / 60);
              if (hoursWorked < 0) hoursWorked += 24;
              if (hoursWorked > 0) {
                actualHours += hoursWorked;
              }
            }
          }
        });
      }

      if (!todayOnly) {
        const todayRecords = db.attendance && db.attendance[today];
        const todayRecord = todayRecords && todayRecords.find(r => r.employeeId === emp.id);

        if (!todayRecord && db.shiftActive && emp.shift) {
          const shiftStart = emp.shift.split(' - ')[0];
          if (shiftStart) {
            const [sH, sM] = shiftStart.split(':').map(Number);
            const shiftStartMinutes = sH * 60 + sM;
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            if (currentMinutes > shiftStartMinutes) {
              const elapsed = (currentMinutes - shiftStartMinutes) / 60;
              actualHours += elapsed;
            }
          }
        }
      }

      if (emp.salaryPresentDays != null) presentDays = emp.salaryPresentDays;
      if (emp.salaryAbsentDays != null) absentDays = emp.salaryAbsentDays;
      if (emp.salaryLateDays != null) lateDays = emp.salaryLateDays;

      const basePay = actualHours * emp.hourlyRate;
      const overtimeHours = emp.overtimeHours || 0;
      const overtimePay = overtimeHours * (emp.hourlyRate * 1.5);
      const totalSalary = basePay + overtimePay;

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        hourlyRate: emp.hourlyRate,
        presentDays,
        absentDays,
        lateDays,
        actualHours: parseFloat(actualHours.toFixed(2)),
        overtimeHours,
        baseSalary: parseFloat(basePay.toFixed(2)),
        overtimeSalary: parseFloat(overtimePay.toFixed(2)),
        totalSalary: parseFloat(totalSalary.toFixed(2))
      };
    });
  }

  // Add new employee
  addEmployee(employee) {
    const db = window.dbManager.get();
    const newId = "e" + (db.employees.length + 1);
    const newEmp = {
      id: newId,
      name: employee.name,
      role: employee.role,
      hourlyRate: parseFloat(employee.hourlyRate),
      shift: employee.shift || "09:00 - 17:00",
      rating: 5.0,
      performance: "New Joiner",
      ordersCompleted: 0,
      overtimeHours: 0.0
    };
    db.employees.push(newEmp);
    window.dbManager.save(db);
    this.initAttendanceToday();
    return newEmp;
  }

  // Update existing employee
  updateEmployee(id, updates) {
    const db = window.dbManager.get();
    const emp = db.employees.find(e => e.id === id);
    if (!emp) return null;
    if (updates.name) emp.name = updates.name;
    if (updates.role) emp.role = updates.role;
    if (updates.hourlyRate) emp.hourlyRate = parseFloat(updates.hourlyRate);
    if (updates.shift) emp.shift = updates.shift;
    window.dbManager.save(db);
    return emp;
  }
}

const employeeSystem = new EmployeeSystem();
window.employeeSystem = employeeSystem; // Expose globally
