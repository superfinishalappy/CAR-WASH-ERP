const fs = require('fs');
const p = 'c:/Users/LENOVO/Desktop/CAR WASH ERP/src/components/screens/SalesHistoryScreen.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/\{\/\* Base Amount \*\/}\r?\n\s*\{\(isOwner \|\| isManager \|\| isSeniorStaff\) && \(\<div/g, '{/* Base Amount */}\n        {(isOwner || isManager) && (<div');
c = c.replace(/\{\/\* Extra Amount \*\/}\r?\n\s*\{\(isOwner \|\| isManager \|\| isSeniorStaff\) && \(\<div/g, '{/* Extra Amount */}\n        {(isOwner || isManager) && (<div');
c = c.replace(/\{\/\* Average Job Value \*\/}\r?\n\s*\{\(isOwner \|\| isManager \|\| isSeniorStaff\) && \(\<div/g, '{/* Average Job Value */}\n        {(isOwner || isManager) && (<div');

fs.writeFileSync(p, c, 'utf8');
console.log('Revert done');
