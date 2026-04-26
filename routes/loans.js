const router = require("express").Router();
const supabase = require("../lib/supabase");
const auth = require("../middleware/auth");

router.use(auth);

const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const today = () => new Date().toISOString().split("T")[0];

// GET /api/loans  — optionally ?status=Overdue or ?borrower_id=xxx
router.get("/", async (req, res) => {
  let query = supabase
    .from("loans")
    .select("*, borrowers(name, phone)")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (req.query.status) query = query.eq("status", req.query.status);
  if (req.query.borrower_id) query = query.eq("borrower_id", req.query.borrower_id);

  const { data: loans, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Auto-update overdue on fetch (same logic as frontend)
  const overdueIds = loans
    .filter(l => l.status === "Active" && l.due_date < today())
    .map(l => l.id);

  if (overdueIds.length > 0) {
    await supabase
      .from("loans")
      .update({ status: "Overdue" })
      .in("id", overdueIds)
      .eq("user_id", req.user.id);
    loans.forEach(l => { if (overdueIds.includes(l.id)) l.status = "Overdue"; });
  }

  res.json(loans);
});

// GET /api/loans/:id
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("loans")
    .select("*, borrowers(name, phone, address)")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (error) return res.status(404).json({ error: "Loan not found" });
  res.json(data);
});

// POST /api/loans
router.post("/", async (req, res) => {
  const { borrower_id, principal, interest_rate, term_days, start_date, notes } = req.body;
  if (!borrower_id || !principal) return res.status(400).json({ error: "borrower_id and principal are required" });

  const due_date = addDays(start_date || today(), parseInt(term_days) || 30);

  const { data, error } = await supabase
    .from("loans")
    .insert({
      user_id: req.user.id,
      borrower_id,
      principal: parseFloat(principal),
      interest_rate: parseFloat(interest_rate) || 5,
      term_days: parseInt(term_days) || 30,
      start_date: start_date || today(),
      due_date,
      status: "Active",
      notes: notes || ""
    })
    .select("*, borrowers(name, phone)")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/loans/:id
router.put("/:id", async (req, res) => {
  const { principal, interest_rate, term_days, start_date, notes, status, borrower_id } = req.body;

  const updates = {};
  if (principal !== undefined) updates.principal = parseFloat(principal);
  if (interest_rate !== undefined) updates.interest_rate = parseFloat(interest_rate);
  if (term_days !== undefined) {
    updates.term_days = parseInt(term_days);
    updates.due_date = addDays(start_date || today(), parseInt(term_days));
  }
  if (start_date !== undefined) updates.start_date = start_date;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;
  if (borrower_id !== undefined) updates.borrower_id = borrower_id;

  const { data, error } = await supabase
    .from("loans")
    .update(updates)
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select("*, borrowers(name, phone)")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Loan not found" });
  res.json(data);
});

// POST /api/loans/:id/mark-paid  (convenience: fully settle loan)
router.post("/:id/mark-paid", async (req, res) => {
  // Fetch loan + existing payments
  const { data: loan, error: lErr } = await supabase
    .from("loans")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (lErr || !loan) return res.status(404).json({ error: "Loan not found" });

  const { data: pmts } = await supabase
    .from("payments")
    .select("amount")
    .eq("loan_id", loan.id);

  const paid = (pmts || []).reduce((s, p) => s + p.amount, 0);
  const interest = loan.principal * loan.interest_rate / 100;
  const balance = Math.max(0, loan.principal + interest - paid);

  if (balance > 0) {
    await supabase.from("payments").insert({
      user_id: req.user.id,
      loan_id: loan.id,
      amount: balance,
      date: today(),
      method: "Cash",
      note: "Full settlement"
    });
  }

  const { data: updated } = await supabase
    .from("loans")
    .update({ status: "Paid" })
    .eq("id", loan.id)
    .select()
    .single();

  res.json(updated);
});

// DELETE /api/loans/:id
router.delete("/:id", async (req, res) => {
  const { error } = await supabase
    .from("loans")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
