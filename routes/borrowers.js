const router = require("express").Router();
const supabase = require("../lib/supabase");
const auth = require("../middleware/auth");

// All routes require auth
router.use(auth);

// GET /api/borrowers
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("borrowers")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/borrowers/:id
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("borrowers")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (error) return res.status(404).json({ error: "Borrower not found" });
  res.json(data);
});

// POST /api/borrowers
router.post("/", async (req, res) => {
  const { name, phone, address, id_type, id_no } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });

  const { data, error } = await supabase
    .from("borrowers")
    .insert({ user_id: req.user.id, name, phone, address, id_type, id_no })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/borrowers/:id
router.put("/:id", async (req, res) => {
  const { name, phone, address, id_type, id_no } = req.body;

  const { data, error } = await supabase
    .from("borrowers")
    .update({ name, phone, address, id_type, id_no })
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Borrower not found" });
  res.json(data);
});

// DELETE /api/borrowers/:id
router.delete("/:id", async (req, res) => {
  // Cascading deletes are handled by the DB schema (ON DELETE CASCADE)
  const { error } = await supabase
    .from("borrowers")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
