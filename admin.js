const cfg = window.MADAR_CONFIG || {};

const configured =
  cfg.SUPABASE_URL?.startsWith("https://") &&
  !cfg.SUPABASE_URL.includes("YOUR_") &&
  cfg.SUPABASE_ANON_KEY &&
  !cfg.SUPABASE_ANON_KEY.includes("YOUR_");

const db = configured && window.supabase
  ? window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    )
  : null;

const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginMessage = document.getElementById("login-message");

let rows = [];

function statusLabel(s) {
  return {
    pending: "قيد المراجعة",
    interview: "مقابلة",
    waitlist: "قائمة انتظار",
    accepted: "مقبول",
    rejected: "مرفوض"
  }[s] || s;
}

function showLogin(msg = "") {
  loginPanel.hidden = false;
  dashboard.hidden = true;
  loginMessage.textContent = msg;
}

function showDashboard(user) {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  document.getElementById("admin-email").textContent = user.email || "";
  loadApplications();
}

async function checkSession() {
  if (!db) {
    showLogin("أكمل إعداد Supabase في config.js أولًا.");
    return;
  }

  const { data, error } = await db.auth.getSession();

  if (error) {
    showLogin("تعذر التحقق من جلسة الدخول.");
    return;
  }

  if (data.session) {
    const { data: admin, error: adminError } = await db
      .from("admins")
      .select("user_id")
      .eq("user_id", data.session.user.id)
      .maybeSingle();

    if (adminError) {
      showLogin("تعذر التحقق من صلاحيات الإدارة.");
      return;
    }

    if (admin) {
      showDashboard(data.session.user);
    } else {
      await db.auth.signOut();
      showLogin("هذا الحساب غير مصرح له بدخول لوحة الإدارة.");
    }
  } else {
    showLogin();
  }
}

document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  loginMessage.textContent = "";

  if (!db) {
    showLogin("أكمل إعداد Supabase في config.js أولًا.");
    return;
  }

  const f = new FormData(e.currentTarget);

  const { data, error } = await db.auth.signInWithPassword({
    email: f.get("email"),
    password: f.get("password")
  });

  if (error) {
    showLogin("تعذر تسجيل الدخول. راجع البريد وكلمة المرور.");
    return;
  }

  const { data: admin, error: adminError } = await db
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError || !admin) {
    await db.auth.signOut();
    showLogin("الحساب غير موجود ضمن قائمة مسؤولي مَدار.");
    return;
  }

  showDashboard(data.user);
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  showLogin("تم تسجيل الخروج.");
});

document.getElementById("refresh-btn").addEventListener("click", loadApplications);
document.getElementById("search-input").addEventListener("input", render);
document.getElementById("status-filter").addEventListener("change", render);

async function loadApplications() {
  const body = document.getElementById("applications-body");

  body.innerHTML = '<tr><td colspan="6">جارٍ تحميل الطلبات...</td></tr>';

  const { data, error } = await db
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    body.innerHTML = '<tr><td colspan="6">تعذر تحميل الطلبات.</td></tr>';
    console.error("MADAR LOAD ERROR:", error);
    return;
  }

  rows = data || [];

  document.getElementById("total-count").textContent = rows.length;
  document.getElementById("pending-count").textContent =
    rows.filter(x => x.status === "pending").length;
  document.getElementById("accepted-count").textContent =
    rows.filter(x => x.status === "accepted").length;
  document.getElementById("rejected-count").textContent =
    rows.filter(x => x.status === "rejected").length;

  render();
}

function render() {
  const q = document.getElementById("search-input").value.toLowerCase();
  const s = document.getElementById("status-filter").value;

  const filtered = rows.filter(x =>
    (!s || x.status === s) &&
    (`${x.full_name} ${x.email}`.toLowerCase().includes(q))
  );

  const body = document.getElementById("applications-body");

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="6">لا توجد طلبات مطابقة.</td></tr>';
    return;
  }

  body.innerHTML = "";

  filtered.forEach(x => {
    const tr = document.createElement("tr");
    const date = new Date(x.created_at).toLocaleDateString("ar-EG");

    tr.innerHTML = `
      <td>${escapeHtml(x.full_name)}</td>
      <td>${escapeHtml(x.email)}</td>
      <td>${escapeHtml(x.school_year)}</td>
      <td>${date}</td>
      <td><span class="status ${escapeHtml(x.status)}">${escapeHtml(statusLabel(x.status))}</span></td>
      <td><button class="view-btn" data-id="${escapeHtml(x.id)}">عرض التفاصيل</button></td>
    `;

    body.appendChild(tr);
  });

  body.querySelectorAll(".view-btn").forEach(b => {
    b.addEventListener("click", () => showDetails(b.dataset.id));
  });
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

async function showDetails(id) {
  const x = rows.find(r => String(r.id) === String(id));
  if (!x) return;

  const details = `الاسم: ${x.full_name}
تاريخ الميلاد: ${x.date_of_birth}
البريد: ${x.email}
الهاتف: ${x.phone || "—"}
المحافظة: ${x.governorate}
المدرسة: ${x.school}
الصف: ${x.school_year}

التعريف بالنفس: ${x.self_introduction}
الدافع: ${x.motivation}
الاهتمامات: ${x.interests}
المبادرة: ${x.initiative_example || "—"}
التفرغ: ${x.weekly_availability}`;

  alert(details);

  const rubric = [
    ["الدافع الحقيقي (0–25)", "score_motivation", 25],
    ["التفكير والتعبير (0–20)", "score_thinking", 20],
    ["الفضول والاهتمامات (0–20)", "score_curiosity", 20],
    ["المبادرة والأنشطة (0–15)", "score_initiative", 15],
    ["الالتزام (0–10)", "score_commitment", 10],
    ["التوافق مع قيم مَدار (0–10)", "score_values", 10]
  ];

  const updates = {};

  for (const [label, key, max] of rubric) {
    const current = x[key] ?? "";
    const raw = prompt(
      `${label}\nاتركها فارغة لتجاوز التقييم.`,
      current
    );

    if (raw === null) return;

    if (raw.trim() === "") {
      updates[key] = null;
      continue;
    }

    const n = Number(raw);

    if (!Number.isInteger(n) || n < 0 || n > max) {
      alert(`أدخل رقمًا صحيحًا من 0 إلى ${max}.`);
      return;
    }

    updates[key] = n;
  }

  const vals = rubric.map(([, key]) => updates[key]);

  updates.score_total = vals.every(v => v !== null)
    ? vals.reduce((a, b) => a + b, 0)
    : null;

  const note = prompt(
    "ملاحظات المُقيّم (اختياري):",
    x.reviewer_notes || ""
  );

  if (note === null) return;

  updates.reviewer_notes = note;

  const nextStatus = prompt(
    "الحالة:\npending / interview / waitlist / accepted / rejected",
    x.status || "pending"
  );

  const allowedStatuses = [
    "pending",
    "interview",
    "waitlist",
    "accepted",
    "rejected"
  ];

  if (nextStatus === null) return;

  const normalizedStatus = nextStatus.trim().toLowerCase();

  if (!allowedStatuses.includes(normalizedStatus)) {
    alert("الحالة غير صحيحة؛ لم يتم الحفظ.");
    return;
  }

  updates.status = normalizedStatus;

  const { data: saved, error } = await db
    .from("applications")
    .update(updates)
    .eq("id", id)
    .select("id,status");

  if (error) {
    console.error("MADAR SAVE ERROR:", error);
    alert("فشل الحفظ:\n" + error.message);
    return;
  }

  if (!saved || saved.length === 0) {
    alert("لم يتم تحديث أي طلب. راجع صلاحيات UPDATE في Supabase.");
    return;
  }

  alert("تم حفظ التقييم وحالة الطالب بنجاح.");

  await loadApplications();
}

checkSession();
