# B2B Matchmaking Widget Miniapp

Готовая widget-версия miniapp для каталога платформы. Это статический сайт, который можно разместить на Vercel, nginx, S3 или любом HTTPS-хостинге.

## Что внутри

- `index.html` - разметка виджета.
- `styles.css` - адаптивные стили под iframe/webview.
- `miniapp-sdk.js` - тонкий bridge для host-приложения и нашей miniapp-платформы.
- `app.js` - логика B2B matchmaking.
- `manifest.json` - описание miniapp и поддерживаемого контракта.

## Режимы работы

### 1. Standalone

Откройте `index.html` напрямую. Miniapp запустится с demo context.

### 2. Через текущий backend launch token

Если URL miniapp открыть так:

```txt
https://example.com/b2b-matchmaking/index.html?launch_token=TOKEN&api_base=http://localhost:8086
```

miniapp запросит:

```txt
GET {api_base}/api/miniapp-sessions/{launch_token}
```

и применит полученный SSO context.

### 3. Через host bridge

Контейнер может встроить miniapp в iframe:

```html
<iframe
  src="https://example.com/b2b-matchmaking/index.html"
  width="100%"
  height="700"
  title="B2B Matchmaking"
></iframe>
```

После загрузки miniapp отправит host-приложению:

```txt
MINIAPP_READY
MINIAPP_CONTEXT_REQUESTED
```

Host может ответить:

```js
iframe.contentWindow.postMessage({
  type: "MINIAPP_CONTEXT",
  payload: {
    user: {
      id: "user-id",
      email: "user@example.com",
      name: "User Name",
      role: "user"
    },
    miniapp: {
      id: "b2b-matchmaking",
      title: "B2B Matchmaking"
    }
  }
}, "*");
```

## События miniapp

Miniapp отправляет события через `postMessage` и `ReactNativeWebView.postMessage`:

- `MINIAPP_READY`
- `MINIAPP_CONTEXT_REQUESTED`
- `MINIAPP_OPENED`
- `MINIAPP_RESIZE`
- `MEETING_REQUEST_CREATED`
- `MINIAPP_CLOSE_REQUESTED`

Host может завершить сессию:

```js
iframe.contentWindow.postMessage({ type: "MINIAPP_LOGOUT" }, "*");
```

## Для публикации в каталоге

В админке можно указать URL на `index.html`. Для текущего backend желательно, чтобы launch URL добавлял не только `launch_token`, но и `api_base`, если miniapp размещен на отдельном домене.
