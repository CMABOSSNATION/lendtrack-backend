const router = require("express").Router();
const supabase = require("../lib/supabase");
const auth = require("../middleware/auth");

// All routes require auth
router.use(auth);

// GET /api/borrowers
router.get("/", async (req, res) => {
  // Exclude heavy photo columns from list view to keep responses fast
  const { data, error } = await supabase
    .from("borrowers")
    .select("id, user_id, name, phone, address, id_type, id_no, created_at")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/borrowers/:id  — full record including photos
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
  const { name, phone, address, id_type, id_no, passport_photo, id_photo } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });

  // Base64 photos can be large — validate they are data URIs if provided
  if (passport_photo && !passport_photo.startsWith("data:image/"))
    return res.status(400).json({ error: "passport_photo must be a base64 data URI (data:image/...)" });
  if (id_photo && !id_photo.startsWith("data:image/"))
    return res.status(400).json({ error: "id_photo must be a base64 data URI (data:image/...)" });

  const { data, error } = await supabase
    .from("borrowers")
    .insert({
      user_id: req.user.id,
      name,
      phone,
      address,
      id_type,
      id_no,
      passport_photo: passport_photo || null,
      id_photo: id_photo || null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/borrowers/:id
router.put("/:id", async (req, res) => {
  const { name, phone, address, id_type, id_no, passport_photo, id_photo } = req.body;

  if (passport_photo && !passport_photo.startsWith("data:image/"))
    return res.status(400).json({ error: "passport_photo must be a base64 data URI" });
  if (id_photo && !id_photo.startsWith("data:image/"))
    return res.status(400).json({ error: "id_photo must be a base64 data URI" });

  const updates = { name, phone, address, id_type, id_no };
  if (passport_photo !== undefined) updates.passport_photo = passport_photo;
  if (id_photo !== undefined) updates.id_photo = id_photo;

  const { data, error } = await supabase
    .from("borrowers")
    .update(updates)
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
  const { error } = await supabase
    .from("borrowers")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
