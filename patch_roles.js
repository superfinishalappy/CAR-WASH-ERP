const fs = require('fs');
function patch(file, replacements) {
  let c = fs.readFileSync(file, 'utf8');
  for (const [search, replace] of replacements) {
    c = c.replace(search, replace);
  }
  fs.writeFileSync(file, c, 'utf8');
}

// 1. SalesHistoryScreen.tsx
patch('c:/Users/LENOVO/Desktop/CAR WASH ERP/src/components/screens/SalesHistoryScreen.tsx', [
  [/const isManager = role === 'manager';/g, "const isManager = role === 'manager';\n  const isSeniorStaff = role === 'senior_staff';"],
  // Base Price, Extra Amount, Avg Ticket
  [/\{\(isOwner \|\| isManager\) && \(\<div/g, "{(isOwner || isManager || isSeniorStaff) && (<div"],
  // Date Presets
  [/\.\.\.\(isOwner \|\| isManager \?/g, "...(isOwner || isManager || isSeniorStaff ?"]
]);

// 2. Sidebar.tsx
patch('c:/Users/LENOVO/Desktop/CAR WASH ERP/src/components/Sidebar.tsx', [
  [/const canTeam = \['superadmin', 'superstaff', 'owner', 'manager'\]\.includes\(role\);/g, "const canTeam = ['superadmin', 'superstaff', 'owner', 'manager', 'senior_staff'].includes(role);"]
]);

// 3. MobileDrawer.tsx
patch('c:/Users/LENOVO/Desktop/CAR WASH ERP/src/components/MobileDrawer.tsx', [
  [/const canTeam = \['superadmin', 'superstaff', 'owner', 'manager'\]\.includes\(role\);/g, "const canTeam = ['superadmin', 'superstaff', 'owner', 'manager', 'senior_staff'].includes(role);"]
]);

// 4. Navigation.tsx
patch('c:/Users/LENOVO/Desktop/CAR WASH ERP/src/components/Navigation.tsx', [
  [/const canTeam = \['superadmin', 'superstaff', 'owner', 'manager'\]\.includes\(role\);/g, "const canTeam = ['superadmin', 'superstaff', 'owner', 'manager', 'senior_staff'].includes(role);"]
]);

// 5. AdvancesScreen.tsx
patch('c:/Users/LENOVO/Desktop/CAR WASH ERP/src/components/screens/AdvancesScreen.tsx', [
  [/const isOwner = role === 'owner' \|\| \['superadmin', 'superstaff'\]\.includes\(role\);/g, "const isOwner = role === 'owner' || ['superadmin', 'superstaff', 'senior_staff'].includes(role);"]
]);

console.log('Patch complete.');
