import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpApi from "i18next-http-backend";
import { USER_SITE, SITE_LANG } from "./consts";

export function initI18n() {
  if (i18next.isInitialized) {
    return;
  }
  i18next
    .use(HttpApi)
    .use(LanguageDetector)
    .init({
      fallbackLng: "zh",
      supportedLngs: ["zh", "en"],
      detection: {
        order: ["querystring", "cookie", "localStorage", "navigator"],
        caches: ["cookie"],
      },
      backend: {
        // 未知原因, {{lng}}无法正常替换
        // loadPath: `${USER_SITE}/locales/{{lng}}/translation.json`,
        loadPath: `${USER_SITE}/locales/${SITE_LANG}/translation.json`,
      },
    });
}
