const router = require("express").Router();
const supabase = require("../lib/supabase");
const auth = require("../middleware/auth");

router.use(auth);

const today = () => new Date().toISOString().split("T")[0];

// GET /api/payments — optionally ?loan_id=xxx
router.get("/", async (req, res) => {
  let query = supabase
    .from("payments")
    .select("*, loans(principal, borrower_id, borrowers(name))")
    .eq("user_id", req.user.id)
    .order("date", { ascending: false });

  if (req.query.loan_id) query = query.eq("loan_id", req.query.loan_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/payments
router.post("/", async (req, res) => {
  const { loan_id, amount, date, method, note } = req.body;
  if (!loan_id || !amount) return res.status(400).json({ error: "loan_id and amount are required" });

  // Fetch loan to compute balance
  const { data: loan, error: lErr } = await supabase
    .from("loans")
    .select("*, payments(amount)")
    .eq("id", loan_id)
    .eq("user_id", req.user.id)
    .single();

  if (lErr || !loan) return res.status(404).json({ error: "Loan not found" });
  if (loan.status === "Paid") return res.status(400).json({ error: "Loan is already fully paid" });

  const paid = (loan.payments || []).reduce((s, p) => s + p.amount, 0);
  const interest = loan.principal * loan.interest_rate / 100;
  const balance = Math.max(0, loan.principal + interest - paid);

  if (parseFloat(amount) > balance) {
    return res.status(400).json({ error: `Amount ${amount} exceeds outstanding balance of ${balance.toFixed(2)}` });
  }

  // Insert payment
  const { data: payment, error: pErr } = await supabase
    .from("payments")
    .insert({
      user_id: req.user.id,
      loan_id,
      amount: parseFloat(amount),
      date: date || today(),
      method: method || "Cash",
      note: note || ""
    })
    .select()
    .single();

  if (pErr) return res.status(500).json({ error: pErr.message });

  // Auto mark loan as Paid if balance is settled
  const newBalance = balance - parseFloat(amount);
  if (newBalance <= 0) {
    await supabase
      .from("loans")
      .update({ status: "Paid" })
      .eq("id", loan_id);
    payment.loan_status = "Paid";
  } else {
    payment.loan_status = loan.status;
    payment.remaining_balance = newBalance;
  }

  res.status(201).json(payment);
});

// DELETE /api/payments/:id
router.delete("/:id", async (req, res) => {
  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
