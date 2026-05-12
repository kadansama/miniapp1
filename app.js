const companies = [
  {
    id: "baraka-invest",
    name: "Baraka Invest",
    country: "UAE",
    sector: "Islamic FinTech",
    score: 96,
    tags: ["sukuk", "digital banking", "partnership"],
    description:
      "Инвестиционная компания ищет технологических партнеров для исламских финансовых продуктов.",
  },
  {
    id: "halal-market-global",
    name: "Halal Market Global",
    country: "Malaysia",
    sector: "Halal Food",
    score: 91,
    tags: ["marketplace", "export", "certification"],
    description:
      "Маркетплейс халяль-продукции для международной торговли, сертификации и экспорта.",
  },
  {
    id: "nur-logistics",
    name: "Nur Logistics",
    country: "Kazakhstan",
    sector: "Logistics",
    score: 88,
    tags: ["supply chain", "warehouse", "cross-border"],
    description:
      "Логистический оператор с фокусом на халяль-цепочки поставок и международные маршруты.",
  },
  {
    id: "salam-education",
    name: "Salam Education",
    country: "Turkiye",
    sector: "Education",
    score: 84,
    tags: ["edtech", "training", "certification"],
    description:
      "Образовательная платформа для программ по исламской экономике и халяль-бизнесу.",
  },
  {
    id: "riyadh-growth-fund",
    name: "Riyadh Growth Fund",
    country: "Saudi Arabia",
    sector: "Investment",
    score: 93,
    tags: ["fund", "startup", "growth"],
    description:
      "Фонд роста рассматривает стартапы в финтехе, логистике и халяль-индустрии.",
  },
  {
    id: "kazan-trade-hub",
    name: "Kazan Trade Hub",
    country: "Russia",
    sector: "Logistics",
    score: 86,
    tags: ["trade", "export", "hub"],
    description:
      "Платформа для торговых связей между российскими и международными компаниями.",
  },
];

const mockContext = {
  user: {
    id: "demo-user",
    name: "Ahmed Al-Farsi",
    email: "ahmed@example.com",
    role: "user",
  },
  miniapp: {
    id: "b2b-matchmaking",
    title: "B2B Matchmaking",
  },
  expires_at: null,
};

let selectedCompany = null;
let meetingRequests = [];
let isHostSessionActive = true;

const elements = {
  sessionDot: document.querySelector("#sessionDot"),
  sessionStatus: document.querySelector("#sessionStatus"),
  userName: document.querySelector("#userName"),
  userRole: document.querySelector("#userRole"),
  miniappName: document.querySelector("#miniappName"),
  searchInput: document.querySelector("#searchInput"),
  sectorFilter: document.querySelector("#sectorFilter"),
  countryFilter: document.querySelector("#countryFilter"),
  clearFilters: document.querySelector("#clearFilters"),
  matchCount: document.querySelector("#matchCount"),
  requestCount: document.querySelector("#requestCount"),
  companiesList: document.querySelector("#companiesList"),
  companiesView: document.querySelector("#companiesView"),
  requestsView: document.querySelector("#requestsView"),
  requestsList: document.querySelector("#requestsList"),
  emptyRequests: document.querySelector("#emptyRequests"),
  modal: document.querySelector("#meetingModal"),
  closeModal: document.querySelector("#closeModal"),
  modalCompanyName: document.querySelector("#modalCompanyName"),
  modalCompanyMeta: document.querySelector("#modalCompanyMeta"),
  meetingTopic: document.querySelector("#meetingTopic"),
  meetingTime: document.querySelector("#meetingTime"),
  sendRequest: document.querySelector("#sendRequest"),
};

function setSessionState(mode) {
  const labels = {
    host: "SSO активен через host bridge",
    launch_token: "SSO активен через launch token",
    access_token: "SSO активен через access token админки",
    mock: "Standalone demo context",
    logout: "Сессия завершена host-приложением",
  };

  elements.sessionStatus.textContent = labels[mode] || labels.mock;
  elements.sessionDot.dataset.mode = mode;
}

function normalizeContext(context) {
  const user = context?.user || {};
  const miniapp = context?.miniapp || {};

  return {
    user: {
      id: user.id || user.user_id || "demo-user",
      name: user.name || user.email || "Гость форума",
      email: user.email || "",
      role: user.role || "user",
    },
    miniapp: {
      id: miniapp.id || "b2b-matchmaking",
      title: miniapp.title || miniapp.name || "B2B Matchmaking",
    },
    expires_at: context?.expires_at || context?.expiresAt || null,
  };
}

function applyContext(context, mode) {
  const normalized = normalizeContext(context);

  elements.userName.textContent = normalized.user.name;
  elements.userRole.textContent = normalized.user.role;
  elements.miniappName.textContent = normalized.miniapp.title;
  setSessionState(mode);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFilteredCompanies() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const sector = elements.sectorFilter.value;
  const country = elements.countryFilter.value;

  return companies.filter((company) => {
    const queryMatch =
      !query ||
      company.name.toLowerCase().includes(query) ||
      company.country.toLowerCase().includes(query) ||
      company.sector.toLowerCase().includes(query) ||
      company.tags.some((tag) => tag.toLowerCase().includes(query));

    const sectorMatch = sector === "all" || company.sector === sector;
    const countryMatch = country === "all" || company.country === country;

    return queryMatch && sectorMatch && countryMatch;
  });
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function renderCompanies() {
  const filtered = getFilteredCompanies();

  elements.matchCount.textContent = filtered.length;

  if (!filtered.length) {
    elements.companiesList.innerHTML = `
      <div class="empty-state">
        <h3>Ничего не найдено</h3>
        <p>Попробуйте изменить фильтры или поисковый запрос.</p>
      </div>
    `;
    window.MiniappSDK.reportHeight();
    return;
  }

  elements.companiesList.innerHTML = filtered
    .map(
      (company) => `
        <article class="company-card">
          <div class="company-head">
            <div class="company-title">
              <div class="company-avatar">${escapeHtml(getInitials(company.name))}</div>
              <div>
                <h3>${escapeHtml(company.name)}</h3>
                <p class="company-meta">${escapeHtml(company.country)} · ${escapeHtml(company.sector)}</p>
              </div>
            </div>
            <div class="score-badge">${company.score}% match</div>
          </div>

          <p class="company-description">${escapeHtml(company.description)}</p>

          <div class="tags">
            ${company.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>

          <div class="company-footer">
            <button class="company-action" type="button" data-action="meeting" data-id="${escapeHtml(company.id)}">
              Назначить встречу
            </button>
            <button class="secondary-btn" type="button" data-action="details" data-id="${escapeHtml(company.id)}">
              Подробнее
            </button>
          </div>
        </article>
      `
    )
    .join("");

  window.MiniappSDK.reportHeight();
}

function openMeetingModal(companyId) {
  if (!isHostSessionActive) {
    return;
  }

  selectedCompany = companies.find((company) => company.id === companyId);

  if (!selectedCompany) {
    return;
  }

  elements.modalCompanyName.textContent = selectedCompany.name;
  elements.modalCompanyMeta.textContent = `${selectedCompany.country} · ${selectedCompany.sector}`;
  elements.meetingTopic.value = "";
  elements.modal.classList.remove("hidden");
  window.MiniappSDK.reportHeight();
}

function closeMeetingModal() {
  selectedCompany = null;
  elements.modal.classList.add("hidden");
  window.MiniappSDK.reportHeight();
}

function addMeetingRequest() {
  if (!selectedCompany || !isHostSessionActive) {
    return;
  }

  const topic = elements.meetingTopic.value.trim() || "B2B partnership discussion";
  const time = elements.meetingTime.value;
  const context = normalizeContext(window.MiniappSDK.getContext() || mockContext);

  const request = {
    id: `meeting_${Date.now()}`,
    company_id: selectedCompany.id,
    company_name: selectedCompany.name,
    country: selectedCompany.country,
    sector: selectedCompany.sector,
    topic,
    time,
    status: "pending",
    user_id: context.user.id,
  };

  meetingRequests.unshift(request);
  elements.requestCount.textContent = meetingRequests.length;

  renderRequests();
  closeMeetingModal();

  window.MiniappSDK.emit("MEETING_REQUEST_CREATED", request);
}

function renderRequests() {
  elements.emptyRequests.classList.toggle("hidden", meetingRequests.length > 0);

  elements.requestsList.innerHTML = meetingRequests
    .map(
      (request) => `
        <div class="request-item">
          <strong>${escapeHtml(request.company_name)}</strong>
          <span>${escapeHtml(request.country)} · ${escapeHtml(request.sector)}</span>
          <span>Тема: ${escapeHtml(request.topic)}</span>
          <span>Время: ${escapeHtml(request.time)}</span>
          <div class="status">pending</div>
        </div>
      `
    )
    .join("");

  window.MiniappSDK.reportHeight();
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tab").forEach((button) => {
    const isActive = button.dataset.tab === tabName;

    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  elements.companiesView.classList.toggle("hidden", tabName !== "companies");
  elements.requestsView.classList.toggle("hidden", tabName !== "requests");
  window.MiniappSDK.reportHeight();
}

function setupEvents() {
  elements.searchInput.addEventListener("input", renderCompanies);
  elements.sectorFilter.addEventListener("change", renderCompanies);
  elements.countryFilter.addEventListener("change", renderCompanies);

  elements.clearFilters.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.sectorFilter.value = "all";
    elements.countryFilter.value = "all";
    renderCompanies();
  });

  elements.companiesList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
      return;
    }

    const companyId = button.dataset.id;
    const action = button.dataset.action;

    if (action === "meeting") {
      openMeetingModal(companyId);
    }

    if (action === "details") {
      openMeetingModal(companyId);
      elements.meetingTopic.value = "Хочу обсудить сотрудничество и детали проекта";
    }
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  elements.closeModal.addEventListener("click", closeMeetingModal);

  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) {
      closeMeetingModal();
    }
  });

  elements.sendRequest.addEventListener("click", addMeetingRequest);

  window.MiniappSDK.on("logout", () => {
    isHostSessionActive = false;
    closeMeetingModal();
    setSessionState("logout");
    document.querySelectorAll("button[data-action='meeting']").forEach((button) => {
      button.disabled = true;
    });
  });
}

async function init() {
  const result = await window.MiniappSDK.init({
    miniappId: "b2b-matchmaking",
    miniappName: "B2B Matchmaking",
    mockContext,
  });

  applyContext(result.context, result.mode);
  setupEvents();
  renderCompanies();
  renderRequests();

  window.MiniappSDK.emit("MINIAPP_OPENED", {
    miniapp_id: "b2b-matchmaking",
    mode: result.mode,
    launch_token_present: Boolean(window.MiniappSDK.getLaunchToken()),
    access_token_present: Boolean(window.MiniappSDK.getAccessToken()),
  });
}

init();
