const CURATOR_APPLICATIONS_KEY = "judo_curator_applications";

export function getCuratorApplications() {
  const raw = localStorage.getItem(CURATOR_APPLICATIONS_KEY);

  if (!raw) {
    localStorage.setItem(CURATOR_APPLICATIONS_KEY, JSON.stringify([]));
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.setItem(CURATOR_APPLICATIONS_KEY, JSON.stringify([]));
    return [];
  }
}

export function addCuratorApplication(application) {
  const current = getCuratorApplications();

  const trimmedName = application.name.trim();
  const trimmedContact = application.contact.trim();

  if (!trimmedName) {
    throw new Error("이름 또는 활동명을 입력해 주세요.");
  }

  if (!trimmedContact) {
    throw new Error("연락처 또는 SNS 계정을 입력해 주세요.");
  }

  const nextApplication = {
    id: `application_${Date.now()}`,
    ...application,
    name: trimmedName,
    contact: trimmedContact,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  const next = [nextApplication, ...current];
  localStorage.setItem(CURATOR_APPLICATIONS_KEY, JSON.stringify(next));

  return nextApplication;
}