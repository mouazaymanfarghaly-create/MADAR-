const cfg = window.MADAR_CONFIG || {};

const configured =
  typeof cfg.SUPABASE_URL === "string" &&
  cfg.SUPABASE_URL.startsWith("https://") &&
  !cfg.SUPABASE_URL.includes("YOUR_") &&
  typeof cfg.SUPABASE_ANON_KEY === "string" &&
  cfg.SUPABASE_ANON_KEY.length > 0 &&
  !cfg.SUPABASE_ANON_KEY.includes("YOUR_");

const client =
  configured && window.supabase
    ? window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      )
    : null;

const yearElement = document.getElementById("year");
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

const form = document.getElementById("application-form");
const message = document.getElementById("form-message");

if (form && message) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "";

    if (!client) {
      message.textContent =
        "تعذر الاتصال بقاعدة البيانات. راجع إعدادات Supabase.";
      message.className = "form-message error";
      return;
    }

    const data = Object.fromEntries(
      new FormData(form).entries()
    );

    const payload = {
      full_name: (data.full_name || "").trim(),
      email: (data.email || "").trim().toLowerCase(),
      date_of_birth: data.date_of_birth,
      phone: (data.phone || "").trim(),
      self_introduction: (data.self_introduction || "").trim(),
      initiative_example:
        (data.initiative_example || "").trim() || null,
      weekly_availability: data.weekly_availability,
      governorate: (data.governorate || "").trim(),
      school: (data.school || "").trim(),
      school_year: data.school_year,
      motivation: (data.motivation || "").trim(),
      interests: (data.interests || "").trim(),
      status: "pending"
    };

    const button = form.querySelector('button[type="submit"]');

    if (button) {
      button.disabled = true;
      button.textContent = "جارٍ إرسال الطلب...";
    }

    try {
      const { error } = await client
        .from("applications")
        .insert([payload]);

      if (error) {
        console.error("MADAR application error:", error);
        message.textContent =
          "تعذر إرسال الطلب حاليًا. حاول مرة أخرى أو تواصل مع إدارة مَدار.";
        message.className = "form-message error";
        return;
      }

      form.reset();

      message.textContent =
        "تم استلام طلبك بنجاح. شكرًا لاهتمامك بالانضمام إلى مَدار!";
      message.className = "form-message success";

    } catch (error) {
      console.error("MADAR connection error:", error);

      message.textContent =
        "حدث خطأ أثناء الاتصال. تأكد من الإنترنت وحاول مرة أخرى.";
      message.className = "form-message error";

    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = 'إرسال الطلب <span>←</span>';
      }
    }
  });
}
