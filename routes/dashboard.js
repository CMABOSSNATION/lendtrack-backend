const router = require("express").Router();
const supabase = require("../lib/supabase");
const auth = require("../middleware/auth");

router.use(auth);

// GET /api/dashboard
router.get("/", async (req, res) => {
  const uid = req.user.id;

  const [loansRes, paymentsRes, borrowersRes] = await Promise.all([
    supabase.from("loans").select("*").eq("user_id", uid),
    supabase.from("payments").select("*").eq("user_id", uid),
    supabase.from("borrowers").select("id").eq("user_id", uid)
  ]);

  if (loansRes.error || paymentsRes.error) {
    return res.status(500).json({ error: "Failed to fetch dashboard data" });
  }

  const loans = loansRes.data;
  const payments = paymentsRes.data;

  const loanBalance = (loan) => {
    const interest = loan.principal * loan.interest_rate / 100;
    const total = loan.principal + interest;
    const paid = payments.filter(p => p.loan_id === loan.id).reduce((s, p) => s + p.amount, 0);
    return Math.max(0, total - paid);
  };

  const activeLoans = loans.filter(l => l.status !== "Paid");

  const totalLoaned = activeLoans.reduce((s, l) => s + l.principal, 0);
  const totalInterest = activeLoans.reduce((s, l) => s + l.principal * l.interest_rate / 100, 0);
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
  const overdueCount = loans.filter(l => l.status === "Overdue").length;
  const totalBorrowers = borrowersRes.data?.length || 0;

  // Overdue loans detail
  const overdueLoans = loans.filter(l => l.status === "Overdue").map(l => ({
    id: l.id,
    borrower_id: l.borrower_id,
    due_date: l.due_date,
    days_overdue: Math.floor((new Date() - new Date(l.due_date)) / 86400000),
    balance: loanBalance(l)
  }));

  // Loans due in 7 days
  const now = new Date();
  const dueSoon = loans.filter(l => {
    const diff = (new Date(l.due_date) - now) / 86400000;
    return l.status === "Active" && diff >= 0 && diff <= 7;
  }).map(l => ({
    id: l.id,
    borrower_id: l.borrower_id,
    due_date: l.due_date,
    days_remaining: Math.ceil((new Date(l.due_date) - now) / 86400000),
    balance: loanBalance(l)
  }));

  // Recent payments (last 5)
  const recentPayments = [...payments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  res.json({
    totalLoaned,
    totalInterest,
    totalOutstanding: totalLoaned + totalInterest,
    totalCollected,
    overdueCount,
    totalBorrowers,
    totalLoans: loans.length,
    activeLoans: activeLoans.length,
    overdueLoans,
    dueSoon,
    recentPayments
  });
});

module.exports = router;
