const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const supabase = require("../lib/supabase");

// ─── POST /api/auth/register ────────────────────────────────────────────────
// Invite-only: requires a valid invite_key. Anyone without a key is rejected.
router.post("/register", async (req, res) => {
  const { name, email, password, company_name, branch, invite_key } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email, and password are required" });
  if (!company_name)
    return res.status(400).json({ error: "Company or branch name is required" });
  if (!invite_key)
    return res.status(400).json({ error: "An invite key is required to register" });

  try {
    // 1. Validate invite key (must exist and not already used)
    const { data: keyRow, error: keyErr } = await supabase
      .from("invite_keys")
      .select("id, used_by")
      .eq("key", invite_key.trim().toUpperCase())
      .single();

    if (keyErr || !keyRow)
      return res.status(403).json({ error: "Invalid invite key. Contact the administrator." });
    if (keyRow.used_by)
      return res.status(403).json({ error: "This invite key has already been used." });

    // 2. Check duplicate email
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) return res.status(409).json({ error: "Email already registered" });

    // 3. Create user (approved immediately because they had a valid key)
    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        name,
        email,
        password_hash,
        company_name,
        branch: branch || "",
        is_approved: true,
        approved_at: new Date().toISOString(),
      })
      .select("id, name, email, company_name, branch")
      .single();

    if (error) throw error;

    // 4. Mark invite key as used
    await supabase
      .from("invite_keys")
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", keyRow.id);

    // 5. Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, company_name: user.company_name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        company_name: user.company_name,
        branch: user.branch,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// Normal email+password login. Returns company_name so the app can show it.
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, password_hash, company_name, branch, is_approved")
      .eq("email", email)
      .single();

    if (error || !user) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.is_approved)
      return res.status(403).json({ error: "Account not yet approved. Contact the administrator." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, company_name: user.company_name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        company_name: user.company_name,
        branch: user.branch,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
// Generates a reset token stored in the DB. In production you would email it;
// here we return it in the response so the user can copy it (no email server needed).
// To add real email: install nodemailer and send the token via SMTP/Gmail.
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    // Always respond 200 to avoid leaking which emails are registered
    if (!user) return res.json({ message: "If that email exists, a reset token has been generated." });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await supabase
      .from("users")
      .update({ reset_token: token, reset_token_expires: expires })
      .eq("id", user.id);

    // TODO: Send email with this token in production.
    // For now the token is returned so the admin / user can copy it.
    res.json({
      message: "Reset token generated. Copy it and use it in the Reset Password screen.",
      reset_token: token, // remove this line once you have email sending
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate reset token" });
  }
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password)
    return res.status(400).json({ error: "Token and new password are required" });

  try {
    const { data: user } = await supabase
      .from("users")
      .select("id, reset_token_expires")
      .eq("reset_token", token)
      .single();

    if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });
    if (new Date(user.reset_token_expires) < new Date())
      return res.status(400).json({ error: "Reset token has expired. Please request a new one." });

    const password_hash = await bcrypt.hash(new_password, 10);

    await supabase
      .from("users")
      .update({ password_hash, reset_token: null, reset_token_expires: null })
      .eq("id", user.id);

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Password reset failed" });
  }
});

module.exports = router;
