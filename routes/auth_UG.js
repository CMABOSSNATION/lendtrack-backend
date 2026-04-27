const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabase");

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { name, email, password, company_name, branch } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email, and password are required" });
  if (!company_name)
    return res.status(400).json({ error: "Company or branch name is required" });

  try {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) return res.status(409).json({ error: "Email already registered" });

    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from("users")
      .insert({ name, email, password_hash, company_name, branch: branch || "" })
      .select("id, name, email, company_name, branch")
      .single();

    if (error) throw error;

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, company_name: user.company_name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, company_name: user.company_name, branch: user.branch }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, password_hash, company_name, branch")
      .eq("email", email)
      .single();

    if (error || !user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, company_name: user.company_name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, company_name: user.company_name, branch: user.branch }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
