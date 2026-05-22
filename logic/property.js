// =====================================================================
// Property Dashboard — صاحب العقار
//   • يعرض فقط عقارات المستخدم الحالي (ownerEmail = sessionStorage.userEmail)
//   • يعرض كل العقود التي أبرمها (مشترياته / استئجاراته)
//   • Add / Delete يُسجَّلان على البلوكشين تلقائياً (داخل السيرفر)
// =====================================================================

const userEmail = sessionStorage.getItem('userEmail');

// حماية: ممنوع الدخول بدون تسجيل
if (!userEmail) {
    window.location.href = '/sign.html';
}

let editMode = false;
let editId   = null;

document.addEventListener('DOMContentLoaded', function () {

    const btn               = document.getElementById("addPropertyBtn");
    const form              = document.getElementById("newPropertyForm");
    const overlay           = document.getElementById("overlay");
    const container         = document.getElementById("propertiesContainer");
    const contractsContainer= document.getElementById("contractsContainer");
    const ownerContractsContainer = document.getElementById("ownerContractsContainer");

    // Header: عرض الإيميل وزر تسجيل الخروج
    document.getElementById('userBadge').textContent = userEmail;
    document.getElementById('signOutBtn').onclick = (e) => {
        e.preventDefault();
        sessionStorage.removeItem('userEmail');
        window.location.href = '/home.html';
    };

    // فتح / إغلاق الفورم
    btn.onclick     = () => { form.style.display = "block"; overlay.style.display = "block"; };
    overlay.onclick = closeForm;
    function closeForm() {
        form.style.display = "none";
        overlay.style.display = "none";
        form.reset();
        editMode = false;
        editId   = null;
    }

    // ======================================================
    // كرت عقار (لقسم My Properties) — تفاصيل بدون صورة
    // ======================================================
    function addPropertyCard(property) {
        const card = document.createElement("div");
        card.className = "fieldCard";

        // شارة الحالة
        const status = property.status || 'available';
        let badge = '';
        if (status === 'sold') {
            badge = `<span class="prop-status sold">SOLD</span>`;
        } else if (status === 'rented') {
            const until = property.statusUntil
                ? new Date(property.statusUntil).toLocaleDateString()
                : '';
            badge = `<span class="prop-status rented">RENTED${until ? ' until ' + until : ''}</span>`;
        } else {
            badge = `<span class="prop-status available">AVAILABLE</span>`;
        }

        card.innerHTML = `
            <h3>${property.propertyName || ""} ${badge}</h3>
            <p><strong>Type:</strong> ${property.propertyType || ""}</p>
            <p><strong>Price:</strong> ${property.price || 0} $</p>
            <p><strong>Location:</strong> ${property.location || ""}</p>
            <p><strong>Description:</strong> ${property.description || "—"}</p>
            <div class="card-actions">
                <button class="edit-btn">Edit</button>
                <button class="delete-btn">Delete</button>
            </div>
        `;

        card.querySelector(".edit-btn").onclick = () => {
            editMode = true;
            editId   = property.id;

            form.propertyName.value    = property.propertyName    || "";
            form.price.value           = property.price           || "";
            form.propertyType.value    = property.propertyType    || "";
            form.location.value        = property.location        || "";
            form.description.value     = property.description     || "";
            form.ownerName.value       = property.ownerName       || "";
            form.ownerNationalId.value = property.ownerNationalId || "";

            form.style.display    = "block";
            overlay.style.display = "block";
        };

        card.querySelector(".delete-btn").onclick = async () => {
            if (!property.id || !confirm("Are you sure?")) return;
            const res  = await fetch(`/delete-property/${property.id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                alert("✅ Deleted\nBlockchain TX: " + (data.txHash || '—').slice(0, 16) + "…");
                loadProperties();
            } else {
                alert("Delete failed");
            }
        };

        container.appendChild(card);
    }

    // ======================================================
    // كرت عقد (مشترياتي / استئجاراتي) — بدون صورة
    // ======================================================
    function addContractCard(c) {
        const card = document.createElement("div");
        card.className = "fieldCard";

        const actionLabel = c.action === 'buy' ? '🟢 Bought' : '🔵 Rented';
        const dateStr = c.createdAt
            ? new Date(c.createdAt).toLocaleDateString()
            : '';

        // تاريخ نهاية الإيجار (إذا كانت)
        let endStr = '';
        if (c.action === 'rent' && c.startDate && c.durationMonths) {
            const start = new Date(c.startDate).getTime();
            if (!isNaN(start)) {
                const end = start + Number(c.durationMonths) * 30 * 24 * 60 * 60 * 1000;
                endStr = `<p><strong>Ends:</strong> ${new Date(end).toLocaleDateString()}</p>`;
            }
        }

        card.innerHTML = `
            <h3>${c.propertyName || 'Property #' + c.propertyId}</h3>
            <p><strong>Status:</strong> ${actionLabel}</p>
            <p><strong>Type:</strong> ${c.propertyType || ''}</p>
            <p><strong>Location:</strong> ${c.location || ''}</p>
            <p><strong>Price:</strong> ${c.price || ''} $</p>
            ${c.action === 'rent' ? `<p><strong>Duration:</strong> ${c.durationMonths || 0} months</p>` : ''}
            ${c.action === 'rent' && c.startDate ? `<p><strong>Starts:</strong> ${new Date(c.startDate).toLocaleDateString()}</p>` : ''}
            ${endStr}
            <p><strong>Date:</strong> ${dateStr}</p>
            <p style="font-size:11px; color:#888; word-break:break-all;">
                <strong>Tx:</strong> ${(c.txHash || '').slice(0, 24)}…
            </p>
        `;
        contractsContainer.appendChild(card);
    }

    // ======================================================
    // كرت عقد على عقاراتي (المشتري/المستأجر معروف)
    // ======================================================
    function addOwnerContractCard(c) {
        const card = document.createElement("div");
        card.className = "fieldCard";

        const isRent = c.action === 'rent';
        const actionLabel = isRent ? '🔵 Rented' : '🟢 Sold';
        const dateStr = c.createdAt
            ? new Date(c.createdAt).toLocaleDateString()
            : '';

        let periodHtml = '';
        if (isRent && c.startDate) {
            const startStr = new Date(c.startDate).toLocaleDateString();
            const endStr   = c.endDate
                ? new Date(c.endDate).toLocaleDateString()
                : '';
            periodHtml = `
                <p><strong>Period:</strong> ${startStr} → ${endStr}</p>
                <p><strong>Duration:</strong> ${c.durationMonths} months</p>
            `;
        }

        card.innerHTML = `
            <h3>${c.propertyName || 'Property #' + c.propertyId}</h3>
            <p><strong>Action:</strong> ${actionLabel}</p>
            <p><strong>Type:</strong> ${c.propertyType || ''}</p>
            <p><strong>Location:</strong> ${c.location || ''}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:8px 0;">
            <p><strong>Client:</strong> ${c.clientName || ''}</p>
            <p><strong>Email:</strong> ${c.clientEmail || ''}</p>
            <p><strong>Phone:</strong> ${c.clientPhone || ''}</p>
            <p><strong>National ID:</strong> ${c.clientNationalId || ''}</p>
            <p><strong>Price:</strong> ${c.price || ''} $</p>
            ${periodHtml}
            <p><strong>Signed:</strong> ${dateStr}</p>
            <p style="font-size:11px; color:#888; word-break:break-all;">
                <strong>Tx:</strong> ${(c.txHash || '').slice(0, 24)}…
            </p>
        `;
        ownerContractsContainer.appendChild(card);
    }

    // ======================================================
    // الإحصائيات
    // ======================================================
    function updateStats(properties) {
        let total = properties.length;
        let sum   = 0;
        properties.forEach(p => sum += Number(p.price || 0));
        const avg = total === 0 ? 0 : sum / total;

        document.getElementById("totalProperties").innerText = total;
        document.getElementById("totalValue").innerText      = sum;
        document.getElementById("avgPrice").innerText        = avg.toFixed(2);
    }

    // ======================================================
    // تحميل عقارات المستخدم
    // ======================================================
    function loadProperties() {
        fetch(`/get-properties?owner=${encodeURIComponent(userEmail)}`)
            .then(res => res.json())
            .then(data => {
                container.innerHTML = "";
                if (!data.properties || data.properties.length === 0) {
                    container.innerHTML = `
                        <p style="text-align:center; color:#777; padding:20px;">
                            You don't have any properties yet — click "Add New Property" to start.
                        </p>`;
                    updateStats([]);
                    return;
                }
                data.properties.forEach(addPropertyCard);
                updateStats(data.properties);
            })
            .catch(err => {
                console.error('Error loading properties:', err);
                container.innerHTML = '<p style="color:red;">Error loading properties</p>';
            });
    }

    // ======================================================
    // تحميل مشتريات/استئجارات المستخدم
    // ======================================================
    function loadContracts() {
        fetch(`/get-my-contracts?email=${encodeURIComponent(userEmail)}`)
            .then(res => res.json())
            .then(data => {
                contractsContainer.innerHTML = "";
                if (!data.contracts || data.contracts.length === 0) {
                    contractsContainer.innerHTML = `
                        <p style="text-align:center; color:#777; padding:20px;">
                            You haven't bought or rented any property yet.
                        </p>`;
                    return;
                }
                data.contracts.forEach(addContractCard);
            })
            .catch(err => console.error('Error loading contracts:', err));
    }

    // ======================================================
    // تحميل العقود التي تمت على عقاراتي (كمالك)
    // ======================================================
    function loadOwnerContracts() {
        fetch(`/get-contracts-on-my-properties?owner=${encodeURIComponent(userEmail)}`)
            .then(res => res.json())
            .then(data => {
                ownerContractsContainer.innerHTML = "";
                if (!data.contracts || data.contracts.length === 0) {
                    ownerContractsContainer.innerHTML = `
                        <p style="text-align:center; color:#777; padding:20px;">
                            No one has bought or rented any of your properties yet.
                        </p>`;
                    return;
                }
                data.contracts.forEach(addOwnerContractCard);
            })
            .catch(err => console.error('Error loading owner contracts:', err));
    }

    loadProperties();
    loadContracts();
    loadOwnerContracts();

    // ======================================================
    // إرسال الفورم — Add أو Update
    // ======================================================
    form.onsubmit = function (e) {
        e.preventDefault();

        // ===== UPDATE =====
        if (editMode) {
            const fd = new FormData(form);
            const data = Object.fromEntries(fd.entries());
            fetch(`/update-property/${editId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            })
            .then(res => res.json())
            .then(resData => {
                if (resData.success) {
                    alert("✅ Updated successfully");
                    loadProperties();
                    closeForm();
                } else {
                    alert("Update failed");
                }
            });
            return;
        }

        // ===== ADD =====
        const formData = new FormData(form);
        formData.append('ownerEmail', userEmail);   // 🔑 ربط العقار بالحساب

        fetch("/add-property", { method: "POST", body: formData })
            .then(res => res.json())
            .then(resData => {
                if (resData.success) {
                    alert("✅ Property added\nBlockchain TX: "
                        + (resData.txHash || '—').slice(0, 16) + "…");
                    loadProperties();
                    closeForm();
                } else {
                    alert("Add failed");
                }
            });
    };

    console.log("✅ property.js ready (layered + blockchain)");
});
