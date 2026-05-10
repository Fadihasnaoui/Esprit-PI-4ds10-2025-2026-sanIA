export const speechLanguageFor = (language) => {
  if (language === 'en') return 'en-US';
  if (language === 'tn') return 'ar-TN';
  return 'fr-FR';
};

const preferredVoiceLangs = {
  fr: ['fr-TN', 'fr-FR', 'fr'],
  en: ['en-US', 'en-GB', 'en'],
  tn: ['ar-TN', 'ar-SA', 'ar-EG', 'ar'],
};

export const getPreferredSpeechVoice = (language) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (!voices.length) return null;

  const preferred = preferredVoiceLangs[language] || preferredVoiceLangs.fr;
  const normalized = voices.map((voice) => ({
    voice,
    lang: String(voice.lang || '').toLowerCase(),
    name: String(voice.name || '').toLowerCase(),
  }));

  for (const lang of preferred) {
    const target = lang.toLowerCase();
    const exact = normalized.find((item) => item.lang === target);
    if (exact) return exact.voice;
    const startsWith = normalized.find((item) => item.lang.startsWith(target));
    if (startsWith) return startsWith.voice;
  }

  if (language === 'tn') {
    const arabicNamed = normalized.find((item) =>
      item.lang.startsWith('ar') ||
      item.name.includes('arabic') ||
      item.name.includes('arabe') ||
      item.name.includes('العربية')
    );
    if (arabicNamed) return arabicNamed.voice;
  }

  return null;
};

export const waitForSpeechVoices = (timeout = 1200) => new Promise((resolve) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    resolve([]);
    return;
  }

  const initialVoices = window.speechSynthesis.getVoices?.() || [];
  if (initialVoices.length) {
    resolve(initialVoices);
    return;
  }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.speechSynthesis.onvoiceschanged = null;
    resolve(window.speechSynthesis.getVoices?.() || []);
  };

  window.speechSynthesis.onvoiceschanged = finish;
  window.setTimeout(finish, timeout);
});

export const configureSpeechUtterance = (utterance, language) => {
  utterance.lang = speechLanguageFor(language);
  const voice = getPreferredSpeechVoice(language);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang || utterance.lang;
  }
  return utterance;
};

export const createSpeechUtterance = async (text, language) => {
  await waitForSpeechVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  configureSpeechUtterance(utterance, language);
  return utterance;
};

export const warmSpeechVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices?.();
};
