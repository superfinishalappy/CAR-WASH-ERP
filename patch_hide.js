const fs = require('fs');
const p = 'c:/Users/LENOVO/Desktop/CAR WASH ERP/src/components/screens/SalesHistoryScreen.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/\{\/\* Total Filtered Sales \*\/}\r?\n\s*<div/g, '{/* Total Filtered Sales */}\n        {(isOwner || isManager || isSeniorStaff) && (<div');
c = c.replace(/\{metrics\.totalCount\} orders\r?\n\s*<\/div>\r?\n\s*<\/div>/g, '{metrics.totalCount} orders\n          </div>\n        </div>)}');

c = c.replace(/\{\/\* Total Paid Sales \*\/}\r?\n\s*<div/g, '{/* Total Paid Sales */}\n        {(isOwner || isManager || isSeniorStaff) && (<div');
c = c.replace(/\{metrics\.paidCount\} paid\r?\n\s*<\/div>\r?\n\s*<\/div>/g, '{metrics.paidCount} paid\n          </div>\n        </div>)}');

c = c.replace(/\{\/\* Total Unpaid \/ Credit Due \*\/}\r?\n\s*<div/g, '{/* Total Unpaid / Credit Due */}\n        {(isOwner || isManager || isSeniorStaff) && (<div');
c = c.replace(/\{metrics\.unpaidCount\} unpaid\/credit\r?\n\s*<\/div>\r?\n\s*<\/div>/g, '{metrics.unpaidCount} unpaid/credit\n          </div>\n        </div>)}');

fs.writeFileSync(p, c, 'utf8');
console.log('Done hiding');
