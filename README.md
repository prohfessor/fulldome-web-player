# Fulldome Web Player

Веб-плеер для показа fulldome- и 360°-видео на куполе планетария. Работает в Chromium/JCEF и управляется Java-приложением [fulldomeplayer](https://github.com/prohfessor/fulldomeplayer).

## Возможности

- проекция fulldome- и эквидистантного 360°-видео;
- загрузка плейлиста из параметра URL;
- воспроизведение заданного временного фрагмента и перемотка;
- управление звуком, типом проекции, поворотом и смещением;
- отправка состояния в Java через JCEF queries;
- автономный запуск в обычном Chromium для разработки и диагностики.

Плеер сохраняет исходную проекцию кадра и не выполняет «нормализацию» fulldome или 360°.

## Установка с nginx

Разместите репозиторий в document root nginx, например:

```text
E:\www\player
```

Откройте:

```text
http://localhost/player/index.html?playlist=test.js
```

Путь плейлиста вычисляется относительно `index.html`, а пути видео внутри плейлиста — относительно document root веб-сервера. Не открывайте страницу через `file://`: загрузка плейлиста использует `fetch()` и требует HTTP-сервер.

## Формат плейлиста

Текст UTF-8, одна запись на строку:

```text
начало,конец,поворот,наклон,флаги,/путь/к/видео.webm
```

Пример:

```text
0,0,0,0,f,/video/show.webm # duration=615.24 # comment=Fulldome-программа
```

Метаданные после `#` сохраняет Java-редактор. Web-player использует только шесть полей воспроизведения перед метаданными.

Основные флаги:

- `f` — fulldome;
- `o` — 360°;
- `m` — без звука;
- `s` — запускать сразу;
- `p` — маркер паузы;
- `h<number>` — вертикальное смещение;
- `n<number>` — приближение/удаление.

## Протокол управления

Java вызывает глобальные функции браузера:

```text
videoNext(...)
play()
pause()
stop()
setCurTime(...)
setBeginTime(...)
setEndTime(...)
setVideo360(...)
setRotate360(...)
setRotateTangage(...)
setRotateUp(...)
setRotateFB(...)
```

Web-player отправляет Java события:

```text
cmd:onload;
cmd:videoinfo;<длительность>
cmd:currenttime;<секунды>
cmd:videoend;
cmd:error;<сообщение>
```

В обычном браузере `window.cefQuery` отсутствует; это предусмотрено и не мешает локальной проверке renderer-а.

## Структура проекта

- `index.html` — минимальная HTML-страница и подключение скриптов;
- `libs/FullDomeRenderer.js` — единственная реализация проекции и воспроизведения;
- `libs/FullDomeRendererPlayer.js` — запуск приложения, загрузка плейлиста и JCEF-мост;
- `libs/DomeMaster.js` — поддержка купольной проекции;
- `libs/common.js` — общие браузерные утилиты;
- `libs/three` — локальная копия Three.js и загрузчиков;
- `libs/draco` — локальный Draco decoder;
- `scenes/cubes.js` — тестовая сцена ориентации;
- `test.js` — пример плейлиста для локальной медиатеки.

## Проверка

```powershell
node --check .\libs\FullDomeRenderer.js
node --check .\libs\FullDomeRendererPlayer.js
node --check .\libs\common.js
node --check .\scenes\cubes.js
```

Также рекомендуется открыть `index.html?playlist=test.js` через nginx и проверить получение событий в консоли браузера.

## Лицензия

Код проекта распространяется по лицензии BSD 3-Clause. Сторонние библиотеки в `libs` остаются под лицензиями соответствующих авторов.
