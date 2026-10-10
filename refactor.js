const fs = require('fs');
let code = fs.readFileSync('src/lib/data-provider.ts', 'utf8');

// 1. Add handleSupabaseError
if (!code.includes('handleSupabaseError')) {
  const methodInsertPoint = code.indexOf('public async syncFromSupabase()');
  code = code.slice(0, methodInsertPoint) + 
`  private handleSupabaseError(error: any, fallbackMessage: string, revertFn?: () => void) {
    if (error) {
      console.error(fallbackMessage, error);
      if (revertFn) revertFn();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('app-sync-error', { detail: { message: \`\${fallbackMessage}: \${error.message}\` } })
        );
      }
    }
  }

  ` + code.slice(methodInsertPoint);
}

// 2. Replace addJob
code = code.replace(
  /supabase\.from\('jobs'\)\.insert\([\s\S]*?\}\)\.then\(\(\{ error \}\) => \{\s*if \(error\) console\.error\('Error adding job:', error\);\s*\}\);/,
  `supabase.from('jobs').insert({\n        id: job.id,\n        company_id: cid,\n        entry_date: job.entry_date,\n        plate: job.plate,\n        mobile: job.mobile,\n        work_type: job.work_type,\n        vehicle_type: job.vehicle_type,\n        staff_id: job.staff_id,\n        price: job.price,\n        extra_amount: job.extra_amount,\n        total: job.total,\n        is_paid: job.is_paid,\n        created_by: job.created_by,\n        created_at: job.created_at,\n        customer_id: job.customer_id\n      }).then(({ error }) => {\n        this.handleSupabaseError(error, 'Error adding job', () => {\n          this.jobs = this.jobs.filter(j => j.id !== job.id);\n        });\n      });`
);

// 3. Replace updateJob
code = code.replace(
  /supabase\.from\('jobs'\)\.update\([\s\S]*?\}\)\.eq\('id', id\)\.then\(\(\{ error \}\) => \{\s*if \(error\) console\.error\('Error updating job:', error\);\s*\}\);/,
  `supabase.from('jobs').update({\n        plate: job.plate,\n        mobile: job.mobile,\n        work_type: job.work_type,\n        vehicle_type: job.vehicle_type,\n        staff_id: job.staff_id,\n        price: job.price,\n        extra_amount: job.extra_amount,\n        total: job.total,\n        is_paid: job.is_paid,\n        customer_id: job.customer_id\n      }).eq('id', id).then(({ error }) => {\n        this.handleSupabaseError(error, 'Error updating job', () => {\n          const idx = this.jobs.findIndex(j => j.id === existing.id);\n          if (idx !== -1) this.jobs[idx] = existing;\n        });\n      });`
);

// 4. Replace deleteJob
code = code.replace(
  /supabase\.from\('jobs'\)\.delete\(\)\.eq\('id', id\)\.then\(\(\{ error \}\) => \{\s*if \(error\) console\.error\('Error deleting job:', error\);\s*\}\);/,
  `supabase.from('jobs').delete().eq('id', id).then(({ error }) => {\n        this.handleSupabaseError(error, 'Error deleting job', () => {\n          this.jobs.unshift(job);\n          this.jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());\n        });\n      });`
);

// 5. Replace addExpense
code = code.replace(
  /supabase\.from\('expenses'\)\.insert\([\s\S]*?\}\)\.then\(\(\{ error \}\) => \{\s*if \(error\) console\.error\('Error adding expense:', error\);\s*\}\);/,
  `supabase.from('expenses').insert({\n        id: expense.id,\n        company_id: cid,\n        entry_date: expense.entry_date,\n        category: expense.category,\n        amount: expense.amount,\n        note: expense.note,\n        created_by: expense.created_by,\n        created_at: expense.created_at\n      }).then(({ error }) => {\n        this.handleSupabaseError(error, 'Error adding expense', () => {\n          this.expenses = this.expenses.filter(e => e.id !== expense.id);\n        });\n      });`
);

// 6. Replace deleteExpense
code = code.replace(
  /supabase\.from\('expenses'\)\.delete\(\)\.eq\('id', id\)\.then\(\(\) => \{\}\);/,
  `supabase.from('expenses').delete().eq('id', id).then(({ error }) => {\n        this.handleSupabaseError(error, 'Error deleting expense', () => {\n          this.expenses.unshift(expense);\n          this.expenses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());\n        });\n      });`
);

// 7. Replace addAdvance
code = code.replace(
  /supabase\.from\('advances'\)\.insert\([\s\S]*?\}\)\.then\(\(\{ error \}\) => \{\s*if \(error\) console\.error\('Error adding advance:', error\);\s*\}\);/,
  `supabase.from('advances').insert({\n        id: advance.id,\n        company_id: cid,\n        entry_date: advance.entry_date,\n        staff_id: advance.staff_id,\n        amount: advance.amount,\n        note: advance.note,\n        created_by: advance.created_by,\n        created_at: advance.created_at\n      }).then(({ error }) => {\n        this.handleSupabaseError(error, 'Error adding advance', () => {\n          this.advances = this.advances.filter(a => a.id !== advance.id);\n        });\n      });`
);

// 8. Replace deleteAdvance
code = code.replace(
  /supabase\.from\('advances'\)\.delete\(\)\.eq\('id', id\)\.then\(\(\) => \{\}\);/,
  `supabase.from('advances').delete().eq('id', id).then(({ error }) => {\n        this.handleSupabaseError(error, 'Error deleting advance', () => {\n          this.advances.unshift(advance);\n          this.advances.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());\n        });\n      });`
);

// 9. Replace markAttendance (update)
code = code.replace(
  /supabase\.from\('attendance'\)\.update\(\{ status \}\)\.eq\('id', existing\.id\)\.then\(\(\) => \{\}\);/,
  `supabase.from('attendance').update({ status }).eq('id', existing.id).then(({ error }) => {\n          this.handleSupabaseError(error, 'Error updating attendance', () => {\n            existing.status = oldStatus;\n          });\n        });`
);

// 10. Replace addAttendance
code = code.replace(
  /supabase\.from\('attendance'\)\.insert\([\s\S]*?\}\)\.then\(\(\{ error \}\) => \{\s*if \(error\) console\.error\('Error marking attendance:', error\);\s*\}\);/,
  `supabase.from('attendance').insert({\n        id: att.id,\n        company_id: cid,\n        entry_date: att.entry_date,\n        staff_id: att.staff_id,\n        status: att.status,\n        created_by: att.created_by,\n        created_at: att.created_at\n      }).then(({ error }) => {\n        this.handleSupabaseError(error, 'Error marking attendance', () => {\n          this.attendance = this.attendance.filter(a => a.id !== att.id);\n        });\n      });`
);

// 11. Replace addCustomerPayment
code = code.replace(
  /supabase\.from\('customer_payments'\)\.insert\([\s\S]*?\}\)\.then\(\(\{ error \}\) => \{\s*if \(error\) console\.error\('Error adding customer payment:', error\);\s*\}\);/,
  `supabase.from('customer_payments').insert({\n        id: payment.id,\n        company_id: cid,\n        entry_date: payment.entry_date,\n        customer_id: payment.customer_id,\n        amount: payment.amount,\n        note: payment.note,\n        created_by: payment.created_by,\n        created_at: payment.created_at\n      }).then(({ error }) => {\n        this.handleSupabaseError(error, 'Error adding payment', () => {\n          this.customerPayments = this.customerPayments.filter(p => p.id !== payment.id);\n        });\n      });`
);

// 12. Replace markJobAsPaid and Unpaid
// These use async/await properly! Wait, do they?
// let's check if they use await supabase.from('jobs').update({ is_paid: job.is_paid }).eq('id', id);
// Yes they do! `const { error } = await supabase.from('jobs').update...`
// And they return { success: false, error: error.message } !
// If they return success: false, the UI handles it and DOES NOT UPDATE the local state (because local state isn't optimistically updated).
// Wait, do they update local state optimistically?
// Let's check `markJobAsPaid` inside `dataProvider.ts`.

fs.writeFileSync('src/lib/data-provider.ts', code);
console.log('Successfully refactored optimistic UI rollbacks in dataProvider.ts');
