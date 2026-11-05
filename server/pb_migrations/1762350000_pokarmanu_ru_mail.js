/// <reference path="../pb_data/types.d.ts" />

// App name "Pokarmanu" and Russian texts for the emails users receive
// (email confirmation, password reset, email change, login from a new place).
// Applied automatically on the next server restart.

const layout = (body) => `
<div style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #14131a;">
${body}
<p style="margin-top: 32px; color: #5d5a6b;">Команда {APP_NAME}</p>
</div>`;

const button = (href, label) =>
  `<p><a href="${href}" target="_blank" rel="noopener" style="display: inline-block; padding: 14px 28px; border-radius: 14px; background: #5b3df5; color: #ffffff; text-decoration: none; font-weight: 700;">${label}</a></p>`;

const TEMPLATES = {
  verificationTemplate: {
    subject: "Подтвердите почту в {APP_NAME}",
    body: layout(`
<p>Здравствуйте!</p>
<p>Спасибо, что пользуетесь {APP_NAME}. Чтобы включить облако и синхронизацию между устройствами, подтвердите адрес почты:</p>
${button("{APP_URL}/_/#/auth/confirm-verification/{TOKEN}", "Подтвердить почту")}
<p style="color: #5d5a6b;">Если вы не регистрировались в {APP_NAME}, просто не обращайте внимания на это письмо.</p>`)
  },
  resetPasswordTemplate: {
    subject: "Новый пароль для {APP_NAME}",
    body: layout(`
<p>Здравствуйте!</p>
<p>Мы получили запрос на смену пароля. Нажмите на кнопку, чтобы задать новый:</p>
${button("{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}", "Задать новый пароль")}
<p style="color: #5d5a6b;">Если вы не просили менять пароль, ничего делать не нужно — старый пароль продолжит работать.</p>`)
  },
  confirmEmailChangeTemplate: {
    subject: "Подтвердите новую почту в {APP_NAME}",
    body: layout(`
<p>Здравствуйте!</p>
<p>Чтобы привязать этот адрес к аккаунту {APP_NAME}, подтвердите его:</p>
${button("{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}", "Подтвердить новую почту")}
<p style="color: #5d5a6b;">Если вы не меняли почту, просто не обращайте внимания на это письмо.</p>`)
  }
};

const AUTH_ALERT = {
  subject: "Вход в {APP_NAME} с нового устройства",
  body: layout(`
<p>Здравствуйте!</p>
<p>В ваш аккаунт {APP_NAME} вошли с нового устройства или из нового места:</p>
<p><em>{ALERT_INFO}</em></p>
<p><strong>Если это были не вы, сразу смените пароль в приложении — все другие устройства будут отключены.</strong></p>
<p style="color: #5d5a6b;">Если это были вы, ничего делать не нужно.</p>`)
};

migrate(
  (app) => {
    const settings = app.settings();
    settings.meta.appName = "Pokarmanu";
    settings.meta.senderName = "Pokarmanu";
    app.save(settings);

    const users = app.findCollectionByNameOrId("users");
    for (const [name, template] of Object.entries(TEMPLATES)) {
      users[name].subject = template.subject;
      users[name].body = template.body;
    }
    users.authAlert.emailTemplate.subject = AUTH_ALERT.subject;
    users.authAlert.emailTemplate.body = AUTH_ALERT.body;
    app.save(users);
  },
  () => {
    // Texts are content; nothing to undo.
  }
);
