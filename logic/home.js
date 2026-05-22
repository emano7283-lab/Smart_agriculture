// =====================================================================
// Home — عرض كل العقارات + بحث + توجيه لصفحة العقد
// =====================================================================

// تبديل الـ Header إذا المستخدم مسجَّل دخول
(function setupHeader() {
    const email = sessionStorage.getItem('userEmail');
    if (!email) return;
    const authLink = document.getElementById('authLink');
    const dashLink = document.getElementById('dashLink');
    authLink.textContent = 'Sign Out';
    authLink.href = '#';
    authLink.onclick = (e) => {
        e.preventDefault();
        sessionStorage.removeItem('userEmail');
        location.reload();
    };
    dashLink.style.display = 'inline-block';
})();

function addPropertyCard(property) {
    const container = document.getElementById("propertiesContainer");
    const card = document.createElement("div");
    card.className = "fieldCard";

    const imgSrc = property.image || "";

    // حالة العقار
    const status = property.status || 'available';
    let badgeHtml = '';
    let actionsHtml = '';

    if (status === 'sold') {
        badgeHtml = `<div class="status-badge sold">SOLD</div>`;
    } else if (status === 'rented') {
        const until = property.statusUntil
            ? new Date(property.statusUntil).toLocaleDateString()
            : '';
        badgeHtml = `<div class="status-badge rented">RENTED${until ? ' until ' + until : ''}</div>`;
    } else {
        actionsHtml = `
            <button class="buy-btn">Buy</button>
            <button class="rent-btn">Rent</button>
        `;
    }

    card.innerHTML = `
        <div class="card-image-wrapper">
            <img src="${imgSrc}" class="property-img" />
            <div class="card-overlay-actions">
                ${badgeHtml}
                ${actionsHtml}
            </div>
        </div>
        <div class="card-content">
            <h3>${property.propertyName || ""}</h3>
            <p><strong>Type:</strong> ${property.propertyType || ""}</p>
            <p><strong>Price:</strong> ${property.price || ""}</p>
            <p><strong>Location:</strong> ${property.location || ""}</p>
        </div>
    `;

    // الأزرار فقط إذا العقار متاح
    if (status === 'available') {
        card.querySelector(".buy-btn").onclick = () => {
            window.location.href = `/contracts.html?id=${property.id}&action=buy`;
        };
        card.querySelector(".rent-btn").onclick = () => {
            window.location.href = `/contracts.html?id=${property.id}&action=rent`;
        };
    }

    container.appendChild(card);
}

function applySearch() {
    const nameValue     = document.getElementById("nameInput").value.toLowerCase();
    const locationValue = document.getElementById("locationInput").value.toLowerCase();
    const typeValue     = document.getElementById("typeInput").value.toLowerCase();
    const priceValue    = document.getElementById("priceInput").value;

    const container = document.getElementById("propertiesContainer");
    container.innerHTML = "";

    fetch("/get-properties")
        .then(res => res.json())
        .then(data => {
            const filtered = data.properties.filter(p => {
                const name     = (p.propertyName || "").toLowerCase();
                const location = (p.location     || "").toLowerCase();
                const type     = (p.propertyType || "").toLowerCase();
                const price    = Number(p.price  || 0);

                return (
                    (nameValue     === "" || name.includes(nameValue)) &&
                    (locationValue === "" || location.includes(locationValue)) &&
                    (typeValue     === "" || type.includes(typeValue)) &&
                    (priceValue    === "" || price <= Number(priceValue))
                );
            });

            if (filtered.length === 0) {
                container.innerHTML = "<p style='text-align:center;'>No results found</p>";
                return;
            }
            filtered.forEach(addPropertyCard);
        });
}

document.addEventListener("DOMContentLoaded", applySearch);
