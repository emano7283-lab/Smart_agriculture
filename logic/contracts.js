// =====================================================================
// Contract page — يعرض تفاصيل العقار + يحفظ العقد على البلوكشين
//
// إصلاحات هذه النسخة:
//   1) كانت تقرأ params.get("type") بينما home.js يُمرّر action ⇒ صُلِّحت.
//   2) كانت تستورد ethers + ABI كـ ES module داخل المتصفح بلا bundler
//      (لا يعمل أصلاً) ⇒ استُبدلت بمكالمة /create-contract التي تسجِّل
//      الكتلة على البلوكشين (Hash-Chain) داخل السيرفر.
// =====================================================================

document.addEventListener("DOMContentLoaded", () => {

    const params      = new URLSearchParams(window.location.search);
    const propertyId  = params.get("id");
    const action      = params.get("action") || params.get("type"); // توافق خلفي

    document.getElementById("propertyId").value   = propertyId || "";
    document.getElementById("contractType").value = action     || "";

    // مدّة العقد للإيجار فقط
    const durationGroup = document.getElementById("durationGroup");
    const durationInput = document.getElementById("duration");
    if (action === "rent") {
        durationGroup.style.display = "block";
        durationInput.required = true;
    } else {
        durationGroup.style.display = "none";
        durationInput.required = false;
    }

    // ===== جلب بيانات العقار =====
    if (!propertyId) {
        alert("No property selected.");
        window.location.href = "/home.html";
        return;
    }

    fetch(`/get-property/${propertyId}`)
        .then(res => res.json())
        .then(data => {
            const p = data.property;
            if (!p) { alert("Property not found"); return; }

            document.getElementById("propertyName").innerText        = p.propertyName    || "";
            document.getElementById("propertyType").innerText        = p.propertyType    || "";
            document.getElementById("propertyPrice").innerText       = p.price           || "";
            document.getElementById("propertyLocation").innerText    = p.location        || "";
            document.getElementById("propertyDescription").innerText = p.description     || "";
            document.getElementById("propertyImage").src             = p.image           || "";
            document.getElementById("ownerName").innerText           = p.ownerName       || "";
            document.getElementById("ownerNationalId").innerText     = p.ownerNationalId || "";

            // 🛡️ منع التوثيق المكرر
            if (p.status === 'sold' || p.status === 'rented') {
                const form = document.getElementById("contractForm");
                const note = document.getElementById("contractText");
                form.style.display = "none";

                if (p.status === 'sold') {
                    note.style.background = '#fdecea';
                    note.style.color = '#c0392b';
                    note.innerText =
                        '⛔ This property has already been sold and cannot be contracted again.';
                } else {
                    const until = p.statusUntil
                        ? new Date(p.statusUntil).toLocaleDateString()
                        : '';
                    note.style.background = '#fff3cd';
                    note.style.color = '#856404';
                    note.innerText =
                        `⏳ This property is currently rented until ${until}. Please try again later.`;
                }
                return;
            }

            // نص العقد حسب نوعه
            const contractText = document.getElementById("contractText");
            if (action === "buy") {
                contractText.innerText =
`This contract confirms transfer of ownership of the property from the owner
to the client for the agreed payment amount. Owner: ${p.ownerName}, National ID: ${p.ownerNationalId}.`;
            } else {
                contractText.innerText =
`This rental contract confirms the lease of the property under agreed terms.
Owner: ${p.ownerName}, National ID: ${p.ownerNationalId}.`;
            }
        })
        .catch(err => {
            console.error(err);
            alert("Could not load property details.");
        });

    // ===== ملء الإيميل تلقائياً لو المستخدم مسجَّل =====
    const sessionEmail = sessionStorage.getItem('userEmail');
    if (sessionEmail) document.getElementById('userEmail').value = sessionEmail;

    // ===== إرسال العقد → السيرفر يخزّنه ويسجّله على البلوكشين =====
    document.getElementById("contractForm").onsubmit = async (e) => {
        e.preventDefault();

        const payload = {
            propertyId,
            action,
            clientName:       document.getElementById("clientName").value,
            clientNationalId: document.getElementById("clientNationalId").value,
            clientPhone:      document.getElementById("phoneNumber").value,
            clientEmail:      document.getElementById("userEmail").value,
            paymentMethod:    document.getElementById("paymentMethod").value,
            startDate:        document.getElementById("startDate").value,
            durationMonths:   document.getElementById("duration").value || 0
        };

        const res  = await fetch("/create-contract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        const msg = document.getElementById("resultMessage");
        if (data.success) {
            msg.style.color = "green";
            msg.innerHTML =
                `✅ Contract created successfully<br>
                 <small>Blockchain TX: <code>${data.txHash}</code></small>`;
        } else {
            msg.style.color = "red";
            msg.innerText = "❌ " + (data.message || "Could not save contract");
        }
    };
});
