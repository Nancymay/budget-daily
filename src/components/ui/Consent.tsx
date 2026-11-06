/** Legal pages live on the site, so the iPhone app opens them in Safari too. */
export const PRIVACY_URL = "https://pokarmanuapp.ru/privacy/";
export const CONSENT_URL = "https://pokarmanuapp.ru/consent/";

/** The separate personal-data consent that 152-FZ asks for when an account is created. */
export function ConsentCheck({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="consent">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        Согласна(ен) на{" "}
        <a href={CONSENT_URL} target="_blank" rel="noopener noreferrer">
          обработку персональных данных
        </a>{" "}
        по{" "}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          политике конфиденциальности
        </a>
      </span>
    </label>
  );
}

export const CONSENT_REQUIRED = "Чтобы создать аккаунт, нужно согласие на обработку данных";
