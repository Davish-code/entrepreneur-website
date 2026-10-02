// ─── FIREBASE IMPORTS (must be at top of ES module) ───
import { db, auth, provider, collection, addDoc, serverTimestamp, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, getDocs, query, where } from "./firebase-config.js";

// ─── MODAL STATE ───
// NOTE: Variables are assigned after DOM parse because modules are deferred.
let _overlay, _signupView, _loginView;

function getModalEls() {
    if (!_overlay)     _overlay     = document.getElementById('auth-modal');
    if (!_signupView)  _signupView  = document.getElementById('signup-form');
    if (!_loginView)   _loginView   = document.getElementById('login-form');
}

// ─── MOBILE MENU ───
window.toggleMenu = function () {
    const navLinks = document.getElementById('nav-links');
    if (navLinks) navLinks.classList.toggle('show');
};

// ─── OPEN MODAL ───
window.openModal = function (type, module = null, tier = 'business') {
    getModalEls();
    if (!_overlay) return;

    _overlay.classList.add('modal-open');
    _overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    window.switchView(type);

    // Pre-select module if coming from a specific CTA
    if (module) {
        const select = document.getElementById('module-select');
        if (select) select.value = module;
        localStorage.setItem('selectedModule', module);
        localStorage.setItem('selectedTier', tier);
    }
    if (tier) localStorage.setItem('selectedTier', tier);

    if (type === 'signup') {
        const title  = document.getElementById('signup-title');
        const desc   = document.getElementById('signup-desc');
        const select = document.getElementById('module-select');

        if (module === 'eduflow') {
            if (title)  title.innerText  = "Configure Academic Portal";
            if (desc)   desc.innerText   = "Provision your EduFlow environment.";
            if (select) select.value     = 'eduflow';
        } else {
            if (title)  title.innerText  = "Configure Enterprise Pilot";
            if (desc)   desc.innerText   = "Provision your secure environment.";
            if (select && module) select.value = module;
            else if (select)      select.value = 'oee';
        }
    }
};

// ─── CLOSE MODAL ───
window.closeModal = function () {
    getModalEls();
    if (!_overlay) return;
    _overlay.classList.remove('modal-open');
    _overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
};

// ─── SWITCH VIEWS ───
window.switchView = function (type) {
    getModalEls();
    if (!_signupView || !_loginView) return;
    if (type === 'signup') {
        _loginView.classList.remove('active');
        _signupView.classList.add('active');
    } else {
        _signupView.classList.remove('active');
        _loginView.classList.add('active');
    }
};

// ─── HANDLE AUTH FORM SUBMIT (Signup + Login) ───
window.handleAuth = async function (event) {
    event.preventDefault();

    const form       = event.target;
    const submitBtn  = form.querySelector('.submit-btn');
    const originalText = submitBtn.innerText;
    const isSignup   = form.closest('#signup-form') !== null;

    if (isSignup) {
        const companyInput  = document.getElementById('company');
        const moduleSelect  = document.getElementById('module-select');
        const emailInput    = document.getElementById('signup-email');
        const passwordInput = document.getElementById('signup-password');

        if (companyInput && companyInput.value) {
            localStorage.setItem('companyName', companyInput.value);
        }
        if (moduleSelect && moduleSelect.value) {
            localStorage.setItem('selectedModule', moduleSelect.value);
        }

        submitBtn.innerText  = "Provisioning...";
        submitBtn.disabled   = true;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
            const user = userCredential.user;

            await addDoc(collection(db, "enterprise_pilots"), {
                companyName:    companyInput.value,
                workEmail:      user.email,
                selectedModule: moduleSelect.value,
                authMethod:     "Manual Email/Password",
                uid:            user.uid,
                status:         "Pending Deployment",
                timestamp:      serverTimestamp()
            });

            console.log("Pilot requested for UID:", user.uid);
            alert("Success! Redirecting to checkout...");
            window.location.href = "checkout.html";
        } catch (error) {
            console.error("Error signing up:", error);
            alert("Error: " + error.message);
            submitBtn.innerText = originalText;
            submitBtn.disabled  = false;
        }
    } else {
        // Login
        const emailInput    = form.querySelector('input[type="email"]');
        const passwordInput = form.querySelector('input[type="password"]');

        submitBtn.innerText = "Authenticating...";
        submitBtn.disabled  = true;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
            await handleLoginSuccess(userCredential.user);
        } catch (error) {
            console.error("Error logging in:", error);
            alert("Login failed: " + error.message);
            submitBtn.innerText = originalText;
            submitBtn.disabled  = false;
        }
    }
};

// ─── SSO VALIDATION (company + module + terms must be filled) ───
window.validateSSO = function () {
    const companyInput   = document.getElementById('company');
    const moduleSelect   = document.getElementById('module-select');
    const termsCheckbox  = document.getElementById('terms-checkbox');
    const googleSsoBtn   = document.getElementById('google-sso-btn');
    const submitBtn      = document.querySelector('#signup-form .submit-btn');

    if (companyInput && moduleSelect && termsCheckbox) {
        const companyFilled  = companyInput.value.trim() !== '';
        const moduleSelected = !moduleSelect.options[moduleSelect.selectedIndex].disabled;
        const termsAccepted  = termsCheckbox.checked;
        const isValid        = companyFilled && moduleSelected && termsAccepted;

        if (googleSsoBtn) googleSsoBtn.disabled = !isValid;
        if (submitBtn)    submitBtn.disabled     = !isValid;
    }
};

// ─── GOOGLE SSO — SIGNUP ───
document.addEventListener('DOMContentLoaded', () => {
    const googleSsoBtn = document.getElementById('google-sso-btn');
    if (googleSsoBtn) {
        googleSsoBtn.addEventListener('click', async () => {
            try {
                const result = await signInWithPopup(auth, provider);
                const user   = result.user;

                const companyInput  = document.getElementById('company');
                const moduleSelect  = document.getElementById('module-select');
                const companyName   = companyInput?.value || "Google Auth User";
                const selectedModule = moduleSelect?.value || "oee";

                if (companyInput?.value)   localStorage.setItem('companyName', companyInput.value);
                if (moduleSelect?.value)   localStorage.setItem('selectedModule', moduleSelect.value);

                await addDoc(collection(db, "enterprise_pilots"), {
                    companyName,
                    workEmail:      user.email,
                    selectedModule,
                    selectedTier:   localStorage.getItem('selectedTier') || 'business',
                    authMethod:     "Google SSO",
                    uid:            user.uid,
                    status:         "Pending Deployment",
                    timestamp:      serverTimestamp()
                });

                alert(`Authenticated successfully as ${user.email}`);
                window.location.href = "checkout.html";
            } catch (error) {
                console.error("SSO Failed:", error.message);
                alert("Authentication failed. Please try again.");
            }
        });
    }

    // ─── GOOGLE SSO — LOGIN ───
    const googleLoginSsoBtn = document.getElementById('google-login-sso-btn');
    if (googleLoginSsoBtn) {
        googleLoginSsoBtn.addEventListener('click', async () => {
            try {
                const result = await signInWithPopup(auth, provider);
                await handleLoginSuccess(result.user);
            } catch (error) {
                console.error("SSO Failed:", error.message);
                alert("Authentication failed. Please try again.");
            }
        });
    }

    // ─── CLOSE MODAL ON BACKDROP CLICK ───
    const overlay = document.getElementById('auth-modal');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) window.closeModal();
        });
    }

    // ─── CLOSE ON ESC ───
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.closeModal();
    });

    // ─── PRICING TABS ───
    const tabs = document.querySelectorAll('.pricing-tab');
    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderPricing(tab.getAttribute('data-model'));
            });
        });
        // Initial render — read the active tab's data-model
        const activeTab = document.querySelector('.pricing-tab.active');
        renderPricing(activeTab ? activeTab.getAttribute('data-model') : 'eduflow');
    }
});

// ─── LOGIN SUCCESS HANDLER ───
async function handleLoginSuccess(user) {
    try {
        const q               = query(collection(db, "enterprise_pilots"), where("uid", "==", user.uid));
        const querySnapshot   = await getDocs(q);
        const modules         = new Set();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.selectedModule) modules.add(data.selectedModule);
        });

        const moduleArray = Array.from(modules);

        if (moduleArray.length === 1) {
            localStorage.setItem("selectedModule", moduleArray[0]);
            alert("Authentication successful. Securing connection to fleet telemetry...");
            window.location.href = "dashboard.html";
        } else if (moduleArray.length > 1) {
            sessionStorage.setItem("availableModules", JSON.stringify(moduleArray));
            window.location.href = "model_select.html";
        } else {
            alert("Authentication successful. Securing connection to fleet telemetry...");
            window.location.href = "dashboard.html";
        }
    } catch (error) {
        console.error("Error fetching modules:", error);
        alert("Error: " + error.message);
    }
}

// ─── PITCH DECK SLIDER ───
let slideIndex = 1;

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.slide')) showSlides(slideIndex);
});

window.changeSlide  = (n) => showSlides(slideIndex += n);
window.currentSlide = (n) => showSlides(slideIndex = n);

function showSlides(n) {
    const slides = document.getElementsByClassName("slide");
    const dots   = document.getElementsByClassName("dot");
    if (slides.length === 0) return;
    if (n > slides.length) slideIndex = 1;
    if (n < 1)             slideIndex = slides.length;
    for (let s of slides) s.classList.remove("active");
    for (let d of dots)   d.classList.remove("active");
    slides[slideIndex - 1].classList.add("active");
    if (dots[slideIndex - 1]) dots[slideIndex - 1].classList.add("active");
}

// ─── DYNAMIC PRICING ───
const pricingData = {
    eduflow: {
        personal:   { price: "₹2999",  period: "/mo", desc: "For individual tutors or small classrooms.",       features: ["Up to 50 students", "Basic NLP Chatbot", "Core Analytics Dashboard"] },
        business:   { price: "₹11,999", period: "/mo", desc: "For mid-sized schools and learning centers.",     features: ["Up to 500 students", "Advanced Adaptive Curriculum", "Teacher Alert System", "Priority Support"] },
        enterprise: { price: "Custom",  period: "",    desc: "For universities and large school districts.",     features: ["Unlimited students", "Custom LLM Fine-tuning", "SIS Integration", "Dedicated Account Manager"] }
    },
    oee: {
        personal:   { price: "₹4999",  period: "/mo", desc: "For single-machine monitoring.",      features: ["1 Edge Node", "Real-time Telemetry", "Basic Uptime Reports"] },
        business:   { price: "₹18,999", period: "/mo", desc: "For small factory floors.",          features: ["Up to 10 Edge Nodes", "Automated Shift Reports", "Historical Trends", "Email Alerts"] },
        enterprise: { price: "Custom",  period: "",    desc: "For full-scale industrial operations.", features: ["Unlimited Edge Nodes", "ERP/MES Integration", "Custom API Access", "24/7 Support"] }
    },
    vision: {
        personal:   { price: "₹2999", period: "/mo", desc: "For basic quality inspection.",        features: ["1 Camera Stream", "Standard Defect Detection", "Daily Summary Reports"] },
        business:   { price: "₹9,999", period: "/mo", desc: "For high-speed production lines.",    features: ["Up to 5 Camera Streams", "Custom Defect Training", "Sub-millimeter Accuracy", "Automated Reject System"] },
        enterprise: { price: "Custom", period: "",    desc: "For global manufacturing plants.",    features: ["Unlimited Streams", "Multi-factory Aggregation", "On-premise Deployment", "Dedicated Engineer"] }
    },
    predictive: {
        personal:   { price: "₹6,999",  period: "/mo", desc: "For critical asset monitoring.",    features: ["Up to 5 Sensors", "Basic Anomaly Detection", "Maintenance Alerts"] },
        business:   { price: "₹21,999", period: "/mo", desc: "For facility-wide maintenance.",    features: ["Up to 50 Sensors", "Advanced Failure Prediction", "Vibration & Thermal Analysis", "Maintenance Scheduling"] },
        enterprise: { price: "Custom",  period: "",    desc: "For heavy industry & energy.",       features: ["Unlimited Sensors", "Digital Twin Integration", "RUL (Remaining Useful Life) Models", "SLA Guarantee"] }
    }
};

function renderPricing(model) {
    const grid = document.getElementById('pricing-grid');
    if (!grid) return;
    const data = pricingData[model];
    if (!data) return;

    grid.classList.add('fade-out');

    setTimeout(() => {
        grid.innerHTML = `
            <div class="pricing-card">
                <div class="tier-label">TIER 01 // BASELINE</div>
                <h3 class="tier-name">Personal</h3>
                <p class="tier-desc">${data.personal.desc}</p>
                <div class="tier-price">${data.personal.price} <span class="tier-price-period">${data.personal.period}</span></div>
                <ul class="tier-features">
                    ${data.personal.features.map(f => `<li class="tier-feature included"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> ${f}</li>`).join('')}
                </ul>
                <button class="btn-pricing outline" onclick="openModal('signup', '${model}', 'personal')">Deploy Personal</button>
            </div>

            <div class="pricing-card popular">
                <div class="popular-badge">MOST POPULAR</div>
                <div class="tier-label">TIER 02 // PRODUCTION</div>
                <h3 class="tier-name">Business</h3>
                <p class="tier-desc">${data.business.desc}</p>
                <div class="tier-price">${data.business.price} <span class="tier-price-period">${data.business.period}</span></div>
                <ul class="tier-features">
                    ${data.business.features.map(f => `<li class="tier-feature included"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> ${f}</li>`).join('')}
                </ul>
                <button class="btn-pricing solid" onclick="openModal('signup', '${model}', 'business')">Deploy Business Pilot</button>
            </div>

            <div class="pricing-card">
                <div class="tier-label">TIER 03 // UNLIMITED</div>
                <h3 class="tier-name">Enterprise</h3>
                <p class="tier-desc">${data.enterprise.desc}</p>
                <div class="tier-price custom">${data.enterprise.price} <span class="tier-price-period">${data.enterprise.period || '/ SLA tiered'}</span></div>
                <ul class="tier-features">
                    ${data.enterprise.features.map(f => `<li class="tier-feature included"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> ${f}</li>`).join('')}
                </ul>
                <button class="btn-pricing outline" onclick="openModal('signup', '${model}', 'enterprise')">Contact Enterprise Desk</button>
            </div>
        `;
        grid.classList.remove('fade-out');
    }, 300);
}